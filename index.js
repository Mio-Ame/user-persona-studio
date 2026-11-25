import { createDefaultSettings } from './src/core.js';
import {
  waitForHostReady,
  loadSettings,
  saveSettings,
  resolveHostContext,
} from './src/host.js';
import { createStudioUI } from './src/ui.js';

export const EXTENSION_VERSION = '1.3.0';

function createDomEl(doc, tag, props = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'hidden') {
      node.hidden = Boolean(v);
      if (v) node.setAttribute('hidden', '');
    } else if (k === 'checked') {
      node.checked = Boolean(v);
    } else if (k === 'type' || k === 'id' || k === 'title') {
      node[k] = v;
      node.setAttribute(k, String(v));
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
  }
  return node;
}

function stopEntryBubble(node, signal) {
  if (!node || typeof node.addEventListener !== 'function') return;
  const stop = (ev) => ev.stopPropagation();
  node.addEventListener('mousedown', stop, { signal });
  node.addEventListener('touchstart', stop, { passive: true, signal });
  node.addEventListener('click', stop, { signal });
}

export function refreshExtensionStylesheet(doc, version = EXTENSION_VERSION) {
  if (!doc || typeof doc.querySelectorAll !== 'function' || !doc.head) return false;
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const matchingLinks = links.filter((lnk) => {
    const href = String(lnk.getAttribute?.('href') || lnk.href || '');
    return href.includes('user-persona-studio') && href.includes('style.css');
  });
  if (matchingLinks.length === 0) return false;
  if (matchingLinks.some((lnk) => String(lnk.getAttribute?.('href') || lnk.href || '').includes(`v=${version}`))) {
    return false;
  }
  const target = matchingLinks[0];
  const currentHref = String(target.getAttribute?.('href') || target.href || '');

  const baseHref = currentHref.split('?')[0];
  const nextHref = `${baseHref}?v=${encodeURIComponent(version)}`;
  const nextLink = doc.createElement('link');
  nextLink.rel = 'stylesheet';
  nextLink.setAttribute('rel', 'stylesheet');
  nextLink.href = nextHref;
  nextLink.setAttribute('href', nextHref);
  nextLink.addEventListener('load', () => {
    try {
      target.remove();
    } catch {
      // ignore
    }
  }, { once: true });
  nextLink.addEventListener('error', () => {
    try {
      nextLink.remove();
    } catch {
      // ignore
    }
  }, { once: true });
  doc.head.appendChild(nextLink);
  return true;
}

export async function createStudioController(options = {}) {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  const win = options.win || (typeof window !== 'undefined' ? window : null);
  if (!doc || !win) {
    throw new Error('createStudioController requires document and window');
  }

  const hostDeps = options.hostDeps || {};
  const controller = new AbortController();
  const { signal } = controller;

  await waitForHostReady({ timeoutMs: options.readyTimeoutMs ?? 5000 }, hostDeps);

  if (!options.skipCssRefresh) {
    refreshExtensionStylesheet(doc, EXTENSION_VERSION);
  }

  let settings = createDefaultSettings(await loadSettings(hostDeps).catch(() => ({})));
  const ctx = await resolveHostContext(hostDeps).catch(() => null);

  let wandEntryEl = null;
  let extSettingsCardEl = null;
  let personaBtnEl = null;
  let drawerPersonaCheckbox = null;
  let drawerWandCheckbox = null;
  let registeredSlashOwned = false;
  let registeredSlashAliasOwned = false;
  let destroyed = false;

  function syncEntryVisibility(uiCfg) {
    const showPersona = uiCfg?.showPersonaBtn !== false;
    const showWand = uiCfg?.showWandMenu !== false;
    if (personaBtnEl) {
      personaBtnEl.hidden = !showPersona;
      if (showPersona) personaBtnEl.removeAttribute('hidden');
      else personaBtnEl.setAttribute('hidden', '');
    }
    if (wandEntryEl) {
      wandEntryEl.hidden = !showWand;
      if (showWand) wandEntryEl.removeAttribute('hidden');
      else wandEntryEl.setAttribute('hidden', '');
    }
    if (drawerPersonaCheckbox) drawerPersonaCheckbox.checked = showPersona;
    if (drawerWandCheckbox) drawerWandCheckbox.checked = showWand;
  }

  async function persistControllerSettings(nextSettings) {
    settings = nextSettings;
    syncEntryVisibility(settings.ui);
    if (options.onSaveSettings) {
      return options.onSaveSettings(nextSettings);
    }
    return saveSettings(nextSettings, hostDeps);
  }

  const ui = createStudioUI({
    initialSettings: settings,
    onSaveSettings: (nextSettings) => persistControllerSettings(nextSettings),
    hostApi: options.hostApi,
    doc,
    win,
    mountTarget: options.mountTarget || doc.body,
    onEntryVisibilityChange: (uiCfg) => syncEntryVisibility(uiCfg),
  });

  function mountHostEntries() {
    if (destroyed) return;

    // 1. #extensionsMenu entry
    const extMenu = doc.getElementById('extensionsMenu');
    if (extMenu && !doc.getElementById('ups-wand-entry')) {
      wandEntryEl = createDomEl(
        doc,
        'div',
        {
          id: 'ups-wand-entry',
          className: 'list-group-item flex-container flexGap5 interactable ups-wand-entry',
          role: 'button',
          tabindex: '0',
          title: '打开客制化成长型 User 人设工坊',
        },
        [
          createDomEl(doc, 'div', { className: 'fa-solid fa-wand-magic-sparkles extensionsMenuExtensionButton' }),
          createDomEl(doc, 'span', { text: 'User 人设工坊' }),
        ]
      );
      wandEntryEl.addEventListener('click', () => {
        if (extMenu.style) extMenu.style.display = 'none';
        ui.open();
      }, { signal });
      extMenu.appendChild(wandEntryEl);
    }

    // 2. #extensions_settings2 (fallback #extensions_settings) drawer card
    const settingsCol = doc.getElementById('extensions_settings2') || doc.getElementById('extensions_settings');
    if (settingsCol && !doc.getElementById('ups-ext-settings')) {
      const openBtn = createDomEl(doc, 'button', {
        type: 'button',
        className: 'menu_button interactable ups-ext-open-btn',
        text: '打开 User 人设工坊',
      });
      openBtn.addEventListener('click', () => ui.open(), { signal });

      drawerPersonaCheckbox = createDomEl(doc, 'input', {
        type: 'checkbox',
        checked: settings.ui.showPersonaBtn !== false,
      });
      drawerPersonaCheckbox.addEventListener('change', () => {
        const cur = ui.getState().settings;
        cur.ui.showPersonaBtn = drawerPersonaCheckbox.checked;
        ui.setSettings(cur);
        persistControllerSettings(ui.getState().settings).catch(() => {});
      }, { signal });

      drawerWandCheckbox = createDomEl(doc, 'input', {
        type: 'checkbox',
        checked: settings.ui.showWandMenu !== false,
      });
      drawerWandCheckbox.addEventListener('change', () => {
        const cur = ui.getState().settings;
        cur.ui.showWandMenu = drawerWandCheckbox.checked;
        ui.setSettings(cur);
        persistControllerSettings(ui.getState().settings).catch(() => {});
      }, { signal });

      extSettingsCardEl = createDomEl(
        doc,
        'div',
        { id: 'ups-ext-settings', className: 'ups-ext-settings' },
        [
          createDomEl(doc, 'div', { className: 'inline-drawer' }, [
            createDomEl(doc, 'div', { className: 'inline-drawer-toggle inline-drawer-header' }, [
              createDomEl(doc, 'b', { text: '客制化成长型 User 人设工坊' }),
              createDomEl(doc, 'div', { className: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' }),
            ]),
            createDomEl(doc, 'div', { className: 'inline-drawer-content' }, [
              createDomEl(doc, 'div', { className: 'ups-ext-drawer-body' }, [
                createDomEl(doc, 'p', {
                  className: 'ups-ext-hint',
                  text: '支持新建直出、旧人设重构、预设条目栈编辑、审美库成长、导出原生预设与自定义 API。',
                }),
                openBtn,
                createDomEl(doc, 'label', { className: 'ups-ext-row' }, [
                  createDomEl(doc, 'span', { text: '显示人设管理面板快捷按钮' }),
                  drawerPersonaCheckbox,
                ]),
                createDomEl(doc, 'label', { className: 'ups-ext-row' }, [
                  createDomEl(doc, 'span', { text: '显示扩展菜单入口' }),
                  drawerWandCheckbox,
                ]),
              ]),
            ]),
          ]),
        ]
      );
      settingsCol.appendChild(extSettingsCardEl);
    }

    // 3. .persona_controls_buttons_block launch button
    const personaRow = doc.querySelector('.persona_controls_buttons_block');
    if (personaRow && !doc.getElementById('ups-persona-entry-btn')) {
      personaBtnEl = createDomEl(
        doc,
        'button',
        {
          id: 'ups-persona-entry-btn',
          type: 'button',
          className: 'menu_button interactable ups-persona-entry-btn',
          title: '打开 User 人设工坊',
          'data-ups-persona-btn': 'true',
          'aria-label': '打开 User 人设工坊',
        },
        [
          createDomEl(doc, 'span', { className: 'fa-solid fa-wand-magic-sparkles' }),
          createDomEl(doc, 'span', { text: '工坊' }),
        ]
      );
      // Prevent unpinned .openDrawer dismissal when tapping button inside #PersonaManagement
      stopEntryBubble(personaBtnEl, signal);
      personaBtnEl.addEventListener('click', () => ui.open(), { signal });
      personaRow.appendChild(personaBtnEl);
    }

    syncEntryVisibility(ui.getState().settings.ui);
  }

  function registerSlashCmd() {
    if (!ctx) return;
    const callback = () => {
      if (destroyed) return '';
      ui.open();
      return '';
    };
    const cmds = ctx.SlashCommandParser?.commands;
    const hasUps = Boolean(cmds && Object.hasOwn(cmds, 'ups'));
    const hasAlias = Boolean(cmds && Object.hasOwn(cmds, 'persona-studio'));
    if (ctx.SlashCommandParser?.addCommandObject && ctx.SlashCommand?.fromProps) {
      if (!hasUps) {
        const cmd = ctx.SlashCommand.fromProps({
          name: 'ups',
          callback,
          aliases: hasAlias ? [] : ['persona-studio'],
          helpString: '打开客制化成长型 User 人设工坊',
        });
        ctx.SlashCommandParser.addCommandObject(cmd);
        registeredSlashOwned = true;
        registeredSlashAliasOwned = !hasAlias;
      }
    } else if (typeof ctx.registerSlashCommand === 'function') {
      if (!hasUps) {
        ctx.registerSlashCommand(
          'ups',
          callback,
          hasAlias ? [] : ['persona-studio'],
          '打开客制化成长型 User 人设工坊'
        );
        registeredSlashOwned = true;
        registeredSlashAliasOwned = !hasAlias;
      }
    }
  }

  // Subscribe to SillyTavern APP_READY & CHAT_CHANGED using exact EventEmitter API
  const eventSource = ctx?.eventSource || null;
  const eventTypes = ctx?.eventTypes || ctx?.event_types || {};
  const appReadyEvent = eventTypes.APP_READY || 'app_ready';
  const chatChangedEvent = eventTypes.CHAT_CHANGED || 'chat_changed';

  const onAppReady = () => {
    mountHostEntries();
    ui.refreshContext();
  };
  const onChatChanged = () => {
    ui.refreshContext();
  };

  if (eventSource && typeof eventSource.on === 'function') {
    eventSource.on(appReadyEvent, onAppReady);
    eventSource.on(chatChangedEvent, onChatChanged);
  }

  mountHostEntries();
  registerSlashCmd();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    controller.abort();

    if (eventSource) {
      const removeFn = eventSource.removeListener?.bind(eventSource) ?? eventSource.off?.bind(eventSource);
      if (removeFn) {
        removeFn(appReadyEvent, onAppReady);
        removeFn(chatChangedEvent, onChatChanged);
      }
    }

    if (registeredSlashOwned) {
      try {
        if (typeof ctx?.unregisterSlashCommand === 'function') {
          ctx.unregisterSlashCommand('ups');
        }
        const cmds = ctx?.SlashCommandParser?.commands;
        if (cmds) {
          if (Object.hasOwn(cmds, 'ups')) {
            delete cmds.ups;
          }
          if (registeredSlashAliasOwned && Object.hasOwn(cmds, 'persona-studio')) {
            delete cmds['persona-studio'];
          }
        }
      } catch {
        // ignore
      }
    }

    try {
      wandEntryEl?.remove();
      extSettingsCardEl?.remove();
      personaBtnEl?.remove();
    } catch {
      // ignore
    }

    ui.destroy();
  }

  if (typeof win.addEventListener === 'function') {
    win.addEventListener('pagehide', () => destroy(), { once: true, signal });
  }

  return {
    open: () => ui.open(),
    close: () => ui.close(),
    toggle: () => ui.toggle(),
    destroy,
    getState: () => ui.getState(),
    host: ui.host,
    shadow: ui.shadow,
    ui,
  };
}

export const mountStudioForTest = createStudioController;

// Guarded auto-boot for SillyTavern / TauriTavern browser runtime
const shouldAutoBoot =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !globalThis.__UPS_DISABLE_AUTO_BOOT__;

if (shouldAutoBoot) {
  const boot = () => {
    createStudioController().catch((err) => {
      console.warn('[user-persona-studio] initialization skipped or failed:', err?.message || err);
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
