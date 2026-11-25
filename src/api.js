// Browser/Node-testable SillyTavern host & Custom OpenAI-compatible API transport layer.
// Consumes pure helpers from ./core.js and host context helpers from ./host.js.

import {
  normalizeBaseUrl,
  buildCustomChatPayload,
  parseChatCompletionChunkOrJson,
} from './core.js';
import { getHostContext, getHostRequestHeaders } from './host.js';

function getBridge() {
  return globalThis.__UPS_HOST_BRIDGE__ && typeof globalThis.__UPS_HOST_BRIDGE__ === 'object'
    ? globalThis.__UPS_HOST_BRIDGE__
    : null;
}

function resolveDeps(deps = {}) {
  const bridge = getBridge();
  const ctx = deps?.ctx ?? deps?.context ?? getHostContext(deps);
  const fetchFn = deps?.directFetch ?? deps?.fetch ?? bridge?.fetch ?? globalThis.fetch;
  const useDirectTransport =
    deps?.transport === 'direct' || typeof deps?.directFetch === 'function';
  const getHeadersFn =
    deps?.getRequestHeaders ??
    bridge?.getRequestHeaders ??
    ctx?.getRequestHeaders ??
    null;

  return {
    ctx,
    fetchFn,
    useDirectTransport,
    getHeaders: async () => {
      if (typeof getHeadersFn === 'function') {
        return (await getHeadersFn()) || { 'Content-Type': 'application/json' };
      }
      return getHostRequestHeaders({}, deps);
    },
  };
}

const UPS_CLASSIFIED_ERROR = Symbol('upsClassifiedApiError');

function markClassifiedError(err) {
  if (err && typeof err === 'object') {
    Object.defineProperty(err, UPS_CLASSIFIED_ERROR, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  }
  return err;
}

function createAbortError(message = '已取消生成') {
  const err = new Error(message);
  err.name = 'AbortError';
  err.code = 'ABORTED';
  return markClassifiedError(err);
}

const BEARER_TOKEN_RE =
  /\bBearer[ \t]+(?:\[已脱敏\](?:[A-Za-z0-9._+%:/=-]*[A-Za-z0-9_+%/=-])?|[A-Za-z0-9._+%:/=-]{7,}[A-Za-z0-9_+%/=-])/gi;

export function scrubApiKeyFromText(input, apiKey = '') {
  let out = String(input ?? '');
  const rawKey = String(apiKey ?? '').trim();
  if (rawKey) {
    const candidateSet = new Set([rawKey]);
    try {
      const encoded = encodeURIComponent(rawKey);
      if (encoded) candidateSet.add(encoded);
    } catch {
      // Ignore malformed surrogate sequences
    }
    try {
      const decoded = decodeURIComponent(rawKey);
      if (decoded && decoded !== rawKey && decoded.trim().length >= 4) {
        candidateSet.add(decoded);
      }
    } catch {
      // Ignore invalid percent-encoding in rawKey
    }
    try {
      const jsonEscaped = JSON.stringify(rawKey).slice(1, -1);
      if (jsonEscaped) {
        candidateSet.add(jsonEscaped);
        if (jsonEscaped.includes('/')) {
          candidateSet.add(jsonEscaped.replace(/\//g, '\\/'));
        }
      }
    } catch {
      // Ignore serialization issues
    }
    if (rawKey.includes('/')) {
      candidateSet.add(rawKey.replace(/\//g, '\\/'));
    }
    if (/\s/.test(rawKey)) {
      const formEncoded = new URLSearchParams([['k', rawKey]]).toString().slice(2);
      if (formEncoded) candidateSet.add(formEncoded);
    }

    const candidates = Array.from(candidateSet)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const candidate of candidates) {
      out = out.split(candidate).join('[已脱敏]');
    }
  }

  out = out.replace(BEARER_TOKEN_RE, 'Bearer [已脱敏]');
  return out;
}

export function createLinkedAbortSignal(callerSignal, timeoutSeconds = 120) {
  if (callerSignal?.aborted) {
    throw createAbortError('已取消生成');
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer = null;

  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason ?? createAbortError('已取消生成'));
  };

  if (callerSignal && typeof callerSignal.addEventListener === 'function') {
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timeoutNum = Number(timeoutSeconds);
  if (Number.isFinite(timeoutNum) && timeoutNum > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      const timeoutErr = new Error('TIMEOUT');
      timeoutErr.name = 'TimeoutError';
      controller.abort(timeoutErr);
    }, timeoutNum * 1000);
    timer?.unref?.();
  }

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    isCallerAborted: () => Boolean(callerSignal?.aborted),
    cleanup() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (callerSignal && typeof callerSignal.removeEventListener === 'function') {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}

function extractCleanErrorDetail(bodyText, fallbackMessage, apiKey) {
  const raw = String(bodyText ?? '').trim();
  let extracted = '';

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.error === 'string') {
          extracted = parsed.error;
        } else if (parsed.error && typeof parsed.error === 'object') {
          extracted = String(parsed.error.message ?? parsed.error.code ?? '');
        }
        if (!extracted) {
          extracted = String(parsed.message ?? parsed.detail ?? '');
        }
      }
    } catch {
      extracted = raw;
    }
  } else {
    extracted = raw;
  }

  if (!extracted && fallbackMessage) {
    extracted = String(fallbackMessage);
  }

  const scrubbed = scrubApiKeyFromText(extracted, apiKey).replace(/\s+/g, ' ').trim();
  return scrubbed.length > 200 ? `${scrubbed.slice(0, 197)}...` : scrubbed;
}

export function classifyApiError({
  status = 0,
  statusText = '',
  bodyText = '',
  quotaError = false,
  error = null,
  timedOut = false,
  callerAborted = false,
  apiKey = '',
} = {}) {
  const isAbortDom =
    error?.name === 'AbortError' || error?.code === 20 || error?.code === 'ABORT_ERR';
  if (callerAborted || (isAbortDom && !timedOut)) {
    return createAbortError('已取消生成');
  }

  if (timedOut || error?.name === 'TimeoutError' || error?.code === 'TIMEOUT') {
    const err = new Error('请求超时，请检查网络连接或适当调大超时时间');
    err.name = 'TimeoutError';
    err.code = 'TIMEOUT';
    err.status = Number(status) || 0;
    return markClassifiedError(err);
  }

  const statusNum = Number(status) || 0;
  const cleanStatusText = scrubApiKeyFromText(statusText, apiKey).trim();
  const scrubbedDetail = extractCleanErrorDetail(bodyText, error?.message, apiKey);
  const combined = `${cleanStatusText} ${scrubbedDetail}`;
  const errCodes = [error?.code, error?.cause?.code]
    .filter((c) => typeof c === 'string')
    .map((c) => c.toUpperCase());
  const hasNetworkCode = errCodes.some((c) =>
    [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
    ].includes(c)
  );

  let code = 'API_ERROR';
  let message = '';

  if (
    statusNum === 401 ||
    statusNum === 403 ||
    (statusNum === 400 && /unauthorized|invalid.*api.?key|incorrect.*key|authentication/i.test(combined)) ||
    /invalid_api_key|incorrect api key|unauthorized/i.test(combined)
  ) {
    code = 'AUTH_ERROR';
    message = '鉴权失败（401/403）：API Key 无效、已过期或无权访问该模型';
  } else if (statusNum === 404) {
    code = 'NOT_FOUND';
    message = '接口地址或模型不存在（404）：请检查 Base URL（通常需包含 /v1）与模型名称';
  } else if (
    statusNum === 429 ||
    quotaError ||
    /rate.?limit|too many requests|insufficient_quota/i.test(combined)
  ) {
    code = 'RATE_LIMIT';
    message = '请求过于频繁或额度不足（429）：请稍后重试或检查账户配额';
  } else if (
    statusNum === 502 ||
    statusNum === 503 ||
    statusNum === 504 ||
    error?.name === 'TypeError' ||
    hasNetworkCode ||
    /failed to fetch|networkerror|econnrefused|enotfound|etimedout/i.test(combined)
  ) {
    code = 'NETWORK_ERROR';
    message = scrubbedDetail
      ? `网络连接失败或上游服务异常：${scrubbedDetail}`
      : '网络连接失败或上游服务暂不可用，请检查 Base URL 与网络连通性';
  } else {
    const statusPart = statusNum ? `HTTP ${statusNum}` : '请求失败';
    message = scrubbedDetail
      ? `${statusPart}：${scrubbedDetail}`
      : `${statusPart}，请检查 API 配置后重试`;
  }

  const outErr = new Error(scrubApiKeyFromText(message, apiKey));
  outErr.code = code;
  outErr.status = statusNum;
  return markClassifiedError(outErr);
}

async function consumeAsyncStream(streamOrFactory, { signal, onChunk }) {
  const source = typeof streamOrFactory === 'function' ? streamOrFactory() : streamOrFactory;
  const iterator =
    source && typeof source[Symbol.asyncIterator] === 'function'
      ? source[Symbol.asyncIterator]()
      : source;
  let fullText = '';
  let aborted = false;

  try {
    while (true) {
      if (signal?.aborted) {
        aborted = true;
        throw createAbortError('已取消生成');
      }

      const step = await raceWithAbortSignal(iterator.next(), signal);
      if (!step || step.done) {
        break;
      }

      if (signal?.aborted) {
        aborted = true;
        throw createAbortError('已取消生成');
      }

      const chunk = step.value;
      if (typeof chunk === 'string') {
        const nextText = chunk;
        if (nextText.length > fullText.length && nextText.startsWith(fullText)) {
          const delta = nextText.slice(fullText.length);
          fullText = nextText;
          if (delta) onChunk?.(delta, fullText);
        } else if (nextText) {
          fullText += nextText;
          onChunk?.(nextText, fullText);
        }
        continue;
      }

      if (chunk && typeof chunk === 'object') {
        if (chunk.delta !== undefined && chunk.delta !== null) {
          const delta = String(chunk.delta);
          if (delta) {
            fullText += delta;
            onChunk?.(delta, fullText);
          }
          continue;
        }

        const nextText = String(chunk.text ?? chunk.content ?? '');
        if (nextText.length > fullText.length && nextText.startsWith(fullText)) {
          const delta = nextText.slice(fullText.length);
          fullText = nextText;
          if (delta) onChunk?.(delta, fullText);
        } else if (nextText && nextText !== fullText) {
          const delta = nextText;
          fullText = nextText;
          onChunk?.(delta, fullText);
        }
      }
    }

    return fullText;
  } catch (err) {
    if (err?.[UPS_CLASSIFIED_ERROR] && err?.code === 'ABORTED') {
      aborted = true;
    } else if (signal?.aborted) {
      aborted = true;
    }
    throw err;
  } finally {
    if (aborted || signal?.aborted) {
      try {
        const ret = iterator?.return?.();
        if (ret && typeof ret.then === 'function') {
          await Promise.race([ret.catch(() => {}), Promise.resolve()]);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function raceWithAbortSignal(promise, signal, onAbortError = null) {
  const buildAbortError = () =>
    typeof onAbortError === 'function' ? onAbortError() : createAbortError('已取消生成');
  if (!signal) return Promise.resolve(promise);
  if (signal.aborted) {
    Promise.resolve(promise).catch(() => {});
    return Promise.reject(buildAbortError());
  }

  let onAbort = null;
  const abortPromise = new Promise((_, reject) => {
    onAbort = () => reject(buildAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([Promise.resolve(promise), abortPromise]).finally(() => {
    if (onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  });
}

async function readCompletionResponse(res, { stream, onChunk, apiKey, linked }) {
  const createLinkedSignalError = () => {
    if (linked?.isCallerAborted?.()) {
      return createAbortError('已取消生成');
    }
    if (linked?.isTimedOut?.()) {
      return classifyApiError({ status: res.status, timedOut: true, apiKey });
    }
    return createAbortError('已取消生成');
  };

  if (!res.ok) {
    const errBody =
      typeof res.text === 'function'
        ? await raceWithAbortSignal(res.text(), linked?.signal, createLinkedSignalError).catch((e) => {
            if (e && e[UPS_CLASSIFIED_ERROR]) throw e;
            return '';
          })
        : '';
    if (linked?.isCallerAborted?.()) {
      throw createAbortError('已取消生成');
    }
    if (linked?.isTimedOut?.()) {
      throw classifyApiError({ status: res.status, timedOut: true, apiKey });
    }
    throw classifyApiError({
      status: res.status,
      statusText: res.statusText,
      bodyText: errBody,
      apiKey,
    });
  }

  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
  const hasReader = Boolean(res.body && typeof res.body.getReader === 'function');

  if (hasReader && (stream || contentType.includes('text/event-stream'))) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let mode = contentType.includes('text/event-stream') ? 'sse' : 'sniff';
    let jsonBuffer = '';
    let lineBuffer = '';
    let fullText = '';
    let streamDone = false;
    let readerCancelled = false;
    let sawValidSseData = false;
    let sawMalformedSseData = false;

    const cancelReaderSafely = async () => {
      if (readerCancelled || streamDone) return;
      readerCancelled = true;
      try {
        const cancelRet = reader?.cancel?.();
        if (cancelRet && typeof cancelRet.then === 'function') {
          await Promise.race([cancelRet.catch(() => {}), Promise.resolve()]);
        }
      } catch {
        // Ignore reader cancel errors
      }
    };

    const processSseLine = async (trimmedLine, { allowJsonFallback = false } = {}) => {
      if (!trimmedLine) return false;
      if (trimmedLine.startsWith(':') || /^(?:event|id|retry):/i.test(trimmedLine)) return false;

      if (trimmedLine.startsWith('{')) {
        let obj = null;
        try {
          obj = JSON.parse(trimmedLine);
        } catch {
          if (allowJsonFallback) {
            return 'switch_to_json';
          }
        }
        if (obj && (obj.error || obj.quota_error)) {
          await cancelReaderSafely();
          throw classifyApiError({
            status: res.status,
            bodyText: trimmedLine,
            quotaError: Boolean(obj.quota_error),
            apiKey,
          });
        }
      } else if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trim();
        if (dataStr.startsWith('{')) {
          let obj = null;
          try {
            obj = JSON.parse(dataStr);
          } catch {
            obj = null;
          }
          if (obj && (obj.error || obj.quota_error)) {
            await cancelReaderSafely();
            throw classifyApiError({
              status: res.status,
              bodyText: dataStr,
              quotaError: Boolean(obj.quota_error),
              apiKey,
            });
          }
        }
      }

      const parsed = parseChatCompletionChunkOrJson(trimmedLine);
      if (parsed.error) {
        if (trimmedLine.startsWith('{') || parsed.error !== '响应解析失败') {
          await cancelReaderSafely();
          throw classifyApiError({
            status: res.status,
            bodyText: parsed.error,
            apiKey,
          });
        }
        if (trimmedLine.startsWith('data:')) {
          sawMalformedSseData = true;
        }
        return false;
      }
      if (
        (trimmedLine.startsWith('data:') && trimmedLine.slice(5).trim().length > 0) ||
        trimmedLine.startsWith('{')
      ) {
        sawValidSseData = true;
      }
      if (parsed.text) {
        fullText += parsed.text;
        onChunk?.(parsed.text, fullText);
      }
      return false;
    };

    try {
      while (true) {
        if (linked?.isCallerAborted?.()) {
          throw createAbortError('已取消生成');
        }
        if (linked?.isTimedOut?.()) {
          throw classifyApiError({ status: res.status, timedOut: true, apiKey });
        }

        const { done, value } = await raceWithAbortSignal(
          reader.read(),
          linked?.signal,
          createLinkedSignalError
        );
        if (done) {
          streamDone = true;
          break;
        }
        if (linked?.isCallerAborted?.()) {
          throw createAbortError('已取消生成');
        }
        if (linked?.isTimedOut?.()) {
          throw classifyApiError({ status: res.status, timedOut: true, apiKey });
        }

        const chunkStr =
          typeof value === 'string' ? value : decoder.decode(value, { stream: true });

        if (mode === 'sniff') {
          jsonBuffer += chunkStr;
          const trimmedStart = jsonBuffer.trimStart();
          if (!trimmedStart) continue;
          if (trimmedStart.startsWith('{') || trimmedStart.startsWith('[')) {
            mode = 'json';
            continue;
          }
          mode = 'sse';
          lineBuffer = jsonBuffer;
          jsonBuffer = '';
        } else if (mode === 'json') {
          jsonBuffer += chunkStr;
          continue;
        } else {
          lineBuffer += chunkStr;
        }

        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? '';
        for (let i = 0; i < lines.length; i += 1) {
          const action = await processSseLine(lines[i].trim(), { allowJsonFallback: true });
          if (action === 'switch_to_json') {
            jsonBuffer = `${lines.slice(i).join('\n')}\n${lineBuffer}`;
            lineBuffer = '';
            mode = 'json';
            break;
          }
        }
      }

      const tailDecoded = decoder.decode();
      if (mode === 'json' || (mode === 'sniff' && jsonBuffer.trim())) {
        const finalJsonStr = (jsonBuffer + tailDecoded).trim();
        if (finalJsonStr.startsWith('{')) {
          let obj = null;
          try {
            obj = JSON.parse(finalJsonStr);
          } catch {
            obj = null;
          }
          if (obj && (obj.error || obj.quota_error)) {
            throw classifyApiError({
              status: res.status,
              bodyText: finalJsonStr,
              quotaError: Boolean(obj.quota_error),
              apiKey,
            });
          }
        }
        const parsed = parseChatCompletionChunkOrJson(finalJsonStr);
        if (parsed.error) {
          throw classifyApiError({
            status: res.status,
            bodyText: parsed.error,
            apiKey,
          });
        }
        if (parsed.text) {
          fullText = parsed.text;
          onChunk?.(parsed.text, fullText);
        }
      } else if (mode === 'sse') {
        const rem = (lineBuffer + tailDecoded).trim();
        if (rem) {
          await processSseLine(rem, { allowJsonFallback: false });
        }
        if (!sawValidSseData && sawMalformedSseData) {
          throw classifyApiError({
            status: res.status,
            bodyText: '响应解析失败',
            apiKey,
          });
        }
      }
    } catch (err) {
      if (err && err[UPS_CLASSIFIED_ERROR]) {
        if (err.code === 'ABORTED' && linked?.isTimedOut?.() && !linked?.isCallerAborted?.()) {
          throw classifyApiError({
            status: res.status,
            error: err,
            timedOut: true,
            callerAborted: false,
            apiKey,
          });
        }
        throw err;
      }
      throw classifyApiError({
        status: res.status,
        error: err,
        timedOut: Boolean(linked?.isTimedOut?.()),
        callerAborted: Boolean(linked?.isCallerAborted?.()),
        apiKey,
      });
    } finally {
      await cancelReaderSafely();
      try {
        reader?.releaseLock?.();
      } catch {
        // Ignore releaseLock errors
      }
    }

    return fullText;
  }

  // Non-stream or mock response path
  let rawText = '';
  if (typeof res.text === 'function') {
    rawText = await raceWithAbortSignal(res.text(), linked?.signal, createLinkedSignalError);
  } else if (typeof res.json === 'function') {
    rawText = JSON.stringify(
      await raceWithAbortSignal(res.json(), linked?.signal, createLinkedSignalError)
    );
  }

  if (rawText.trimStart().startsWith('{')) {
    let obj = null;
    try {
      obj = JSON.parse(rawText);
    } catch {
      obj = null;
    }
    if (obj && (obj.error || obj.quota_error)) {
      throw classifyApiError({
        status: res.status,
        bodyText: rawText,
        quotaError: Boolean(obj.quota_error),
        apiKey,
      });
    }
  }

  const parsed = parseChatCompletionChunkOrJson(rawText);
  if (parsed.error) {
    throw classifyApiError({
      status: res.status,
      bodyText: parsed.error,
      apiKey,
    });
  }

  const fullText = parsed.text || '';
  if (fullText && typeof onChunk === 'function') {
    onChunk(fullText, fullText);
  }
  return fullText;
}

async function runHostGeneration({ ctx, cleanMessages, effectiveMaxTokens, signal, onChunk }) {
  if (!ctx) {
    throw new Error('未检测到酒馆运行环境，请切换为「自定义 API」或使用「复制提示词」导出后手动生成。');
  }
  if (signal?.aborted) {
    throw createAbortError('已取消生成');
  }

  const hasChatCompletion = typeof ctx.ChatCompletionService?.sendRequest === 'function';
  const hasGenerateRaw = typeof ctx.generateRaw === 'function';
  const hasQuietPrompt = typeof ctx.generateQuietPrompt === 'function';

  if (ctx.mainApi === 'none' || ctx.mainApi === '' || (!hasChatCompletion && !hasGenerateRaw && !hasQuietPrompt)) {
    throw new Error('当前酒馆尚未配置可用的 AI 连接，请在酒馆 API 设置中配置后再试，或切换为「自定义 API」。');
  }

  // Step A1: ChatCompletionService when mainApi === 'openai'
  if (ctx.mainApi === 'openai' && hasChatCompletion) {
    const oai = ctx.chatCompletionSettings;
    const model =
      (typeof ctx.getChatCompletionModel === 'function' ? ctx.getChatCompletionModel(oai) : '') ||
      oai?.openai_model ||
      oai?.custom_model ||
      '';
    const ccSource = oai?.chat_completion_source || '';
    const wantStream = typeof onChunk === 'function' && oai?.stream_openai !== false;

    let requestData = null;
    if (typeof ctx.ChatCompletionService.presetToGeneratePayload === 'function' && oai && ccSource) {
      try {
        requestData = await raceWithAbortSignal(
          ctx.ChatCompletionService.presetToGeneratePayload(
            {},
            {},
            {
              messages: cleanMessages,
              ...(model ? { model } : {}),
              stream: wantStream,
              ...(effectiveMaxTokens ? { max_tokens: effectiveMaxTokens } : {}),
            }
          ),
          signal
        );
      } catch (err) {
        if (err && err[UPS_CLASSIFIED_ERROR]) throw err;
        requestData = null;
      }
      if (signal?.aborted) {
        throw createAbortError('已取消生成');
      }
    }

    if (!requestData && (ccSource || model)) {
      const basePayload = {
        messages: cleanMessages,
        ...(model ? { model } : {}),
        ...(ccSource ? { chat_completion_source: ccSource } : {}),
        ...(effectiveMaxTokens ? { max_tokens: effectiveMaxTokens } : {}),
        stream: wantStream,
      };
      requestData =
        typeof ctx.ChatCompletionService.createRequestData === 'function'
          ? ctx.ChatCompletionService.createRequestData(basePayload)
          : basePayload;
    }

    if (!requestData && oai && !ccSource && !model && !hasGenerateRaw) {
      throw new Error('当前酒馆 Chat Completion 未选择模型或数据源，请先在酒馆 API 面板中完成连接配置。');
    }

    if (requestData) {
      if (signal?.aborted) {
        throw createAbortError('已取消生成');
      }
      let text = '';
      try {
        const res = await raceWithAbortSignal(
          ctx.ChatCompletionService.sendRequest(requestData, true, signal ?? null),
          signal
        );
        if (typeof res === 'function' || typeof res?.[Symbol.asyncIterator] === 'function') {
          text = await consumeAsyncStream(res, { signal, onChunk });
        } else {
          text = typeof res === 'string' ? res : String(res?.content ?? res?.text ?? '');
          if (text && typeof onChunk === 'function') {
            onChunk(text, text);
          }
        }
      } catch (err) {
        if (err && err[UPS_CLASSIFIED_ERROR]) throw err;
        throw classifyApiError({
          error: err,
          callerAborted: Boolean(signal?.aborted),
        });
      }

      if (!text.trim()) {
        throw new Error('宿主模型返回了空内容，请检查酒馆 API 设置与当前预设后重试。');
      }
      return { text, source: 'host:chat-completion' };
    }
  }

  // Step A2: generateRaw (with cloned messages & stream-generator guard)
  if (hasGenerateRaw) {
    let warning;
    if (
      ctx.mainApi === 'openai' &&
      ctx.chatCompletionSettings?.stream_openai &&
      !hasChatCompletion
    ) {
      warning =
        '当前酒馆已开启流式输出，若宿主接口返回生成器或空结果，建议改用支持流式的 ChatCompletionService 或切换自定义 API。';
    }

    let text = '';
    try {
      const raw = await raceWithAbortSignal(
        ctx.generateRaw({
          prompt: cleanMessages.map((m) => ({ ...m })),
          systemPrompt: '',
          responseLength: effectiveMaxTokens ?? null,
          prefill: '',
        }),
        signal
      );

      if (typeof raw === 'function' || typeof raw?.[Symbol.asyncIterator] === 'function') {
        text = await consumeAsyncStream(raw, { signal, onChunk });
      } else {
        text = typeof raw === 'string' ? raw : String(raw?.content ?? raw?.text ?? '');
        if (text && typeof onChunk === 'function') {
          onChunk(text, text);
        }
      }
    } catch (err) {
      if (err && err[UPS_CLASSIFIED_ERROR]) throw err;
      throw classifyApiError({
        error: err,
        callerAborted: Boolean(signal?.aborted),
      });
    }

    if (!text.trim()) {
      throw new Error('宿主模型未生成有效内容，请检查酒馆 API 连接状态后重试。');
    }
    return {
      text,
      source: 'host:generate-raw',
      ...(warning ? { warning } : {}),
    };
  }

  // Step A3: generateQuietPrompt last-resort fallback
  const quietPrompt = cleanMessages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
  let quietOut;
  try {
    quietOut = await raceWithAbortSignal(
      ctx.generateQuietPrompt({
        quietPrompt,
        quietToLoud: false,
        skipWIAN: true,
        responseLength: effectiveMaxTokens ?? null,
      }),
      signal
    );
  } catch (err) {
    if (err && err[UPS_CLASSIFIED_ERROR]) throw err;
    throw classifyApiError({
      error: err,
      callerAborted: Boolean(signal?.aborted),
    });
  }

  const text = typeof quietOut === 'string' ? quietOut : String(quietOut?.content ?? quietOut?.text ?? '');
  if (!text.trim()) {
    throw new Error('宿主模型未生成有效内容，请检查酒馆 API 连接状态后重试。');
  }
  if (typeof onChunk === 'function') {
    onChunk(text, text);
  }
  return {
    text,
    source: 'host:quiet-prompt',
    warning: '当前宿主缺少独立的 Raw 生成接口，已回退至静默生成通道（提示词可能受当前聊天背景影响）。',
  };
}

export async function runStudioGeneration({
  settings,
  messages,
  signal,
  onChunk,
  responseLength,
  deps = {},
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('消息列表不能为空');
  }

  const cleanMessages = messages.map((m) => ({
    role: String(m?.role || 'user'),
    content: String(m?.content ?? ''),
  }));

  const activeScheme = settings?.schemes?.find?.((s) => s.id === settings?.activeSchemeId);
  const explicitLen =
    Number.isFinite(Number(responseLength)) && Number(responseLength) > 0
      ? Number(responseLength)
      : undefined;
  const effectiveMaxTokens = explicitLen ?? activeScheme?.maxTokens ?? undefined;

  const { ctx, fetchFn, useDirectTransport, getHeaders } = resolveDeps(deps);
  const provider = settings?.api?.provider === 'custom' ? 'custom' : 'host';

  if (provider === 'host') {
    return runHostGeneration({
      ctx,
      cleanMessages,
      effectiveMaxTokens,
      signal,
      onChunk,
    });
  }

  // Branch B: provider === 'custom'
  const profiles = Array.isArray(settings?.api?.profiles) ? settings.api.profiles : [];
  const profile =
    profiles.find((p) => p && p.id === settings?.api?.activeProfileId) ||
    (!settings?.api?.activeProfileId && profiles.length > 0 ? profiles[0] : null);

  if (!profile) {
    throw new Error('未找到可用的自定义 API 方案，请先新建并保存一套配置方案。');
  }

  if (typeof fetchFn !== 'function') {
    throw new Error('当前运行环境缺少 fetch 接口，无法发起自定义 API 请求。');
  }

  const profileForRequest = explicitLen ? { ...profile, maxTokens: explicitLen } : profile;
  const wantStream = Boolean(profile.stream);
  const payload = buildCustomChatPayload(profileForRequest, cleanMessages, {
    stream: wantStream,
    target: useDirectTransport ? 'openai_direct' : undefined,
  });

  const linked = createLinkedAbortSignal(signal, profile.timeoutSeconds ?? 120);
  const createLinkedSignalError = () => {
    if (linked.isCallerAborted()) return createAbortError('已取消生成');
    if (linked.isTimedOut()) return classifyApiError({ timedOut: true, apiKey: profile.apiKey });
    return createAbortError('已取消生成');
  };

  try {
    let res;
    if (useDirectTransport) {
      res = await raceWithAbortSignal(
        fetchFn(payload.url, {
          method: 'POST',
          headers: payload.headers,
          cache: 'no-cache',
          body: JSON.stringify(payload.body),
          signal: linked.signal,
        }),
        linked.signal,
        createLinkedSignalError
      );
    } else {
      const headers = await raceWithAbortSignal(
        getHeaders(),
        linked.signal,
        createLinkedSignalError
      );
      if (linked.signal.aborted) {
        throw createLinkedSignalError();
      }
      res = await raceWithAbortSignal(
        fetchFn('/api/backends/chat-completions/generate', {
          method: 'POST',
          headers,
          cache: 'no-cache',
          body: JSON.stringify(payload),
          signal: linked.signal,
        }),
        linked.signal,
        createLinkedSignalError
      );
    }

    const fullText = await readCompletionResponse(res, {
      stream: wantStream,
      onChunk,
      apiKey: profile.apiKey,
      linked,
    });

    if (!String(fullText ?? '').trim()) {
      throw new Error('模型未返回有效文本内容，请检查模型名称与接口配置。');
    }

    return {
      text: fullText,
      source: useDirectTransport ? 'custom:direct' : 'custom:proxy',
    };
  } catch (err) {
    if (err && err[UPS_CLASSIFIED_ERROR]) {
      throw err;
    }
    throw classifyApiError({
      error: err,
      timedOut: linked.isTimedOut(),
      callerAborted: linked.isCallerAborted(),
      apiKey: profile.apiKey,
    });
  } finally {
    linked.cleanup();
  }
}

export async function fetchCustomModels(profile, signal, deps = {}) {
  const baseUrl = normalizeBaseUrl(profile?.baseUrl);
  if (!baseUrl) {
    throw new Error('请填写有效的自定义 API 基础地址');
  }

  const apiKey = String(profile?.apiKey ?? '');
  if (/[\r\n]/.test(apiKey)) {
    throw new Error('API Key 不能包含换行符');
  }

  const { fetchFn, useDirectTransport, getHeaders } = resolveDeps(deps);
  if (typeof fetchFn !== 'function') {
    throw new Error('当前运行环境缺少 fetch 接口，无法拉取模型列表');
  }

  const linked = createLinkedAbortSignal(signal, profile?.timeoutSeconds ?? 30);
  const createLinkedSignalError = () => {
    if (linked.isCallerAborted()) return createAbortError('已取消生成');
    if (linked.isTimedOut()) return classifyApiError({ timedOut: true, apiKey });
    return createAbortError('已取消生成');
  };

  try {
    let res;
    if (useDirectTransport) {
      const headers = { Accept: 'application/json' };
      if (apiKey.trim()) {
        headers.Authorization = `Bearer ${apiKey.trim()}`;
      }
      res = await raceWithAbortSignal(
        fetchFn(`${baseUrl}/models`, {
          method: 'GET',
          headers,
          cache: 'no-cache',
          signal: linked.signal,
        }),
        linked.signal,
        createLinkedSignalError
      );
    } else {
      const headers = await raceWithAbortSignal(
        getHeaders(),
        linked.signal,
        createLinkedSignalError
      );
      if (linked.signal.aborted) {
        throw createLinkedSignalError();
      }
      res = await raceWithAbortSignal(
        fetchFn('/api/backends/chat-completions/status', {
          method: 'POST',
          headers,
          cache: 'no-cache',
          body: JSON.stringify({
            chat_completion_source: 'custom',
            custom_url: baseUrl,
            custom_include_headers: JSON.stringify({
              Authorization: apiKey.trim() ? `Bearer ${apiKey.trim()}` : '',
            }),
          }),
          signal: linked.signal,
        }),
        linked.signal,
        createLinkedSignalError
      );
    }

    if (!res.ok) {
      const errBody =
        typeof res.text === 'function'
          ? await raceWithAbortSignal(res.text(), linked.signal, createLinkedSignalError).catch((e) => {
              if (e && e[UPS_CLASSIFIED_ERROR]) throw e;
              return '';
            })
          : '';
      if (linked.isCallerAborted()) {
        throw createAbortError('已取消生成');
      }
      if (linked.isTimedOut()) {
        throw classifyApiError({ status: res.status, timedOut: true, apiKey });
      }
      throw classifyApiError({
        status: res.status,
        statusText: res.statusText,
        bodyText: errBody,
        timedOut: linked.isTimedOut(),
        callerAborted: linked.isCallerAborted(),
        apiKey,
      });
    }

    const data =
      typeof res.json === 'function'
        ? await raceWithAbortSignal(res.json(), linked.signal, createLinkedSignalError).catch((e) => {
            if (e && e[UPS_CLASSIFIED_ERROR]) throw e;
            return null;
          })
        : null;
    if (!data || data.error === true || (data.error && typeof data.error !== 'boolean')) {
      const errDetail =
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.message || data?.message || '获取模型列表失败，请检查 Base URL 与 API Key';
      throw classifyApiError({
        status: data?.status || 502,
        bodyText: errDetail,
        timedOut: linked.isTimedOut(),
        callerAborted: linked.isCallerAborted(),
        apiKey,
      });
    }

    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data?.data)
          ? data.data.data
          : Array.isArray(data.models)
            ? data.models
            : [];

    const unique = new Set();
    for (const item of rawList) {
      const id =
        typeof item === 'string'
          ? item.trim()
          : String(item?.id ?? item?.model ?? item?.name ?? '').trim();
      if (id) unique.add(id);
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if (err && err[UPS_CLASSIFIED_ERROR]) {
      throw err;
    }
    throw classifyApiError({
      error: err,
      timedOut: linked.isTimedOut(),
      callerAborted: linked.isCallerAborted(),
      apiKey,
    });
  } finally {
    linked.cleanup();
  }
}

export async function testCustomConnection(profile, signal, deps = {}) {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(profile?.baseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      latencyMs: 0,
      modelCount: 0,
      message: '请填写有效的自定义 API 基础地址',
    };
  }

  try {
    const models = await fetchCustomModels(profile, signal, deps);
    const latencyMs = Math.max(0, Date.now() - startedAt);
    return {
      ok: true,
      latencyMs,
      modelCount: models.length,
      message:
        models.length > 0
          ? `连接成功，获取到 ${models.length} 个可用模型`
          : '连接成功（接口返回空模型列表，可手动填写模型名）',
    };
  } catch (err) {
    if (signal?.aborted || err?.code === 'ABORTED') {
      return {
        ok: false,
        latencyMs: Math.max(0, Date.now() - startedAt),
        modelCount: 0,
        message: '已取消生成',
      };
    }

    const isNotFound = err?.code === 'NOT_FOUND' || err?.status === 404;
    const modelName = String(profile?.model ?? '').trim();

    if (isNotFound && modelName) {
      const { fetchFn, useDirectTransport, getHeaders } = resolveDeps(deps);
      if (typeof fetchFn === 'function') {
        let linked = null;
        try {
          linked = createLinkedAbortSignal(signal, profile?.timeoutSeconds ?? 30);
          const createPingSignalError = () => {
            if (linked.isCallerAborted()) return createAbortError('已取消生成');
            if (linked.isTimedOut()) return classifyApiError({ timedOut: true, apiKey: profile?.apiKey });
            return createAbortError('已取消生成');
          };

          const pingPayload = buildCustomChatPayload(
            { ...profile, maxTokens: 256, stream: false },
            [{ role: 'user', content: 'ping' }],
            { stream: false, target: useDirectTransport ? 'openai_direct' : undefined }
          );

          // Force minimal 1-token probe
          if (useDirectTransport) {
            pingPayload.body.max_tokens = 1;
          } else {
            const includeBody = JSON.parse(pingPayload.custom_include_body || '{}');
            includeBody.max_tokens = 1;
            pingPayload.custom_include_body = JSON.stringify(includeBody);
          }

          let pingRes;
          if (useDirectTransport) {
            pingRes = await raceWithAbortSignal(
              fetchFn(pingPayload.url, {
                method: 'POST',
                headers: pingPayload.headers,
                cache: 'no-cache',
                body: JSON.stringify(pingPayload.body),
                signal: linked.signal,
              }),
              linked.signal,
              createPingSignalError
            );
          } else {
            const headers = await raceWithAbortSignal(
              getHeaders(),
              linked.signal,
              createPingSignalError
            );
            if (linked.signal.aborted) {
              throw createPingSignalError();
            }
            pingRes = await raceWithAbortSignal(
              fetchFn('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers,
                cache: 'no-cache',
                body: JSON.stringify(pingPayload),
                signal: linked.signal,
              }),
              linked.signal,
              createPingSignalError
            );
          }

          if (!pingRes.ok) {
            const errBody =
              typeof pingRes.text === 'function'
                ? await raceWithAbortSignal(pingRes.text(), linked.signal, createPingSignalError).catch((e) => {
                    if (e && e[UPS_CLASSIFIED_ERROR]) throw e;
                    return '';
                  })
                : '';
            if (linked.isCallerAborted()) {
              throw createAbortError('已取消生成');
            }
            if (linked.isTimedOut()) {
              throw classifyApiError({ status: pingRes.status, timedOut: true, apiKey: profile?.apiKey });
            }
            throw classifyApiError({
              status: pingRes.status,
              statusText: pingRes.statusText,
              bodyText: errBody,
              timedOut: linked.isTimedOut(),
              callerAborted: linked.isCallerAborted(),
              apiKey: profile?.apiKey,
            });
          }

          const rawBody =
            typeof pingRes.text === 'function'
              ? await raceWithAbortSignal(pingRes.text(), linked.signal, createPingSignalError)
              : JSON.stringify(
                  await raceWithAbortSignal(pingRes.json(), linked.signal, createPingSignalError)
                );
          if (rawBody.trimStart().startsWith('{')) {
            let parsedJson = null;
            try {
              parsedJson = JSON.parse(rawBody);
            } catch {
              parsedJson = null;
            }
            if (parsedJson && (parsedJson.error || parsedJson.quota_error)) {
              throw classifyApiError({
                status: pingRes.status,
                bodyText: rawBody,
                quotaError: Boolean(parsedJson.quota_error),
                apiKey: profile?.apiKey,
              });
            }
          }

          const parsedPing = parseChatCompletionChunkOrJson(rawBody);
          if (parsedPing.error || (!parsedPing.text && !parsedPing.done)) {
            throw classifyApiError({
              status: pingRes.status,
              bodyText: parsedPing.error || rawBody || '连接探针未返回有效的模型响应',
              apiKey: profile?.apiKey,
            });
          }

          return {
            ok: true,
            latencyMs: Math.max(0, Date.now() - startedAt),
            modelCount: 0,
            message: '连接成功（该端点未开放模型列表，已通过对话探针验证可用）',
          };
        } catch (pingErr) {
          const finalErr =
            pingErr && pingErr[UPS_CLASSIFIED_ERROR]
              ? pingErr
              : classifyApiError({
                  error: pingErr,
                  timedOut: Boolean(linked?.isTimedOut?.()),
                  callerAborted: Boolean(linked?.isCallerAborted?.() || signal?.aborted),
                  apiKey: profile?.apiKey,
                });
          return {
            ok: false,
            latencyMs: Math.max(0, Date.now() - startedAt),
            modelCount: 0,
            message: scrubApiKeyFromText(finalErr.message, profile?.apiKey),
          };
        } finally {
          linked?.cleanup();
        }
      }
    }

    return {
      ok: false,
      latencyMs: Math.max(0, Date.now() - startedAt),
      modelCount: 0,
      message: scrubApiKeyFromText(err?.message || '连接测试失败', profile?.apiKey),
    };
  }
}
