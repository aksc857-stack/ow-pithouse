// ── Liste des commandes disponibles ───────────────────────────────────────────
// Source combinée, fidèle à la version odrive-wheel.html :
//   1. ODrive ASCII fondamentaux (r/w/ss/sr/sc/sd…)
//   2. Propriétés du schéma (tous les paths ODrive configurables → r/w)
//   3. Commandes OpenFFBoard cmdparser (axis.*, fx.*, sys.*, gpio.*, odrv.*)

import { ODRIVE_SECTIONS } from './odriveSchema'
import type { TKey } from '@/locales'

type TFn = (key: TKey, vars?: Record<string, string | number>) => string

export type CmdGroup = 'odrv' | 'paths' | 'offb'
export interface CmdItem { grp: CmdGroup; cmd: string; desc: string }

// Mappe chaque groupe vers sa clé i18n (résolue à l'affichage via t()).
export const GROUP_LABELS: Record<CmdGroup, TKey> = {
  odrv:  'cmd.grp_odrv',
  paths: 'cmd.grp_paths',
  offb:  'cmd.grp_offb',
}

export function buildCommandList(t: TFn): CmdItem[] {
  const items: CmdItem[] = []

  // ── 1. ODrive ASCII fondamentaux ──────────────────────────────────────────
  items.push(
    { grp: 'odrv', cmd: 'r ',         desc: t('cmd.r') },
    { grp: 'odrv', cmd: 'w  ',        desc: t('cmd.w') },
    { grp: 'odrv', cmd: 'ss',         desc: t('cmd.ss') },
    { grp: 'odrv', cmd: 'sr',         desc: t('cmd.sr') },
    { grp: 'odrv', cmd: 'sc',         desc: t('cmd.sc') },
    { grp: 'odrv', cmd: 'sd',         desc: t('cmd.sd') },
    { grp: 'odrv', cmd: 'se',         desc: t('cmd.se') },
    { grp: 'odrv', cmd: 'f 0',        desc: t('cmd.f') },
    { grp: 'odrv', cmd: 't 0 ',       desc: t('cmd.t') },
    { grp: 'odrv', cmd: 'q 0  10',    desc: t('cmd.q') },
    { grp: 'odrv', cmd: 'p 0 0 0 0',  desc: t('cmd.p') },
    { grp: 'odrv', cmd: 'v 0 0 0',    desc: t('cmd.v') },
    { grp: 'odrv', cmd: 'c 0 0',      desc: t('cmd.c') },
  )

  // ── 2. Propriétés du schéma — auto-générées (r <path> + w <path> <val>) ─────
  const seen = new Set<string>()
  for (const section of ODRIVE_SECTIONS) {
    for (const group of section.groups) {
      for (const f of group.fields) {
        if (f.protocol !== 'odrv') continue   // les offb sont listés en dur plus bas
        if (!f.path || seen.has(f.path)) continue
        seen.add(f.path)
        const leaf = f.name.split('.').pop() || f.name
        items.push({ grp: 'paths', cmd: 'r ' + f.path, desc: t('cmd.read') + ' ' + leaf })
        items.push({ grp: 'paths', cmd: 'w ' + f.path + ' ', desc: t('cmd.write') + ' ' + leaf })
      }
    }
  }

  // ── 3. OpenFFBoard cmdparser — miroir de cmd_table.cpp ──────────────────────
  const offb = (cmd: string, key: TKey) => items.push({ grp: 'offb', cmd, desc: t(key) })
  // sys.*
  offb('sys.lsmain?',    'cmd.sys_lsmain')
  offb('sys.lsactive?',  'cmd.sys_lsactive')
  offb('sys.heapfree?',  'cmd.sys_heapfree')
  offb('sys.cmdinfo?',   'cmd.sys_cmdinfo')
  offb('sys.temp?',      'cmd.sys_temp')
  offb('sys.swver?',     'cmd.sys_swver')
  offb('sys.hwtype?',    'cmd.sys_hwtype')
  offb('sys.uid?',       'cmd.sys_uid')
  offb('sys.signature?', 'cmd.sys_signature')
  offb('sys.debug?',     'cmd.sys_debug')
  offb('sys.main?',      'cmd.sys_main')
  offb('sys.devid?',     'cmd.sys_devid')
  offb('sys.errors?',    'cmd.sys_errors')
  offb('sys.errorsclr!', 'cmd.sys_errorsclr')
  offb('sys.format!',    'cmd.sys_format')
  offb('sys.flashdump?', 'cmd.sys_flashdump')
  offb('sys.vint?',      'cmd.sys_vint')
  offb('sys.vext?',      'cmd.sys_vext')
  offb('sys.heap?',      'cmd.sys_heap')
  offb('sys.save!',      'cmd.sys_save')
  offb('sys.savestat?',  'cmd.sys_savestat')
  offb('sys.eetest!',    'cmd.sys_eetest')
  offb('sys.eedump?',    'cmd.sys_eedump')
  offb('sys.eeformat!',  'cmd.sys_eeformat')
  offb('sys.vbusdiv',    'cmd.sys_vbusdiv')
  offb('sys.reboot!',    'cmd.sys_reboot')
  offb('sys.uptime?',    'cmd.sys_uptime')
  offb('sys.ping?',      'cmd.sys_ping')
  offb('sys.fxtest?',    'cmd.sys_fxtest')
  // main.*
  offb('main.id?',        'cmd.main_id')
  offb('main.hidrate?',   'cmd.main_hidrate')
  offb('main.cfrate?',    'cmd.main_cfrate')
  offb('main.ffbactive?', 'cmd.main_ffbactive')
  offb('main.hidsendspd', 'cmd.main_hidsendspd')
  offb('main.errors?',    'cmd.main_errors')
  offb('main.lsbtn?',     'cmd.main_lsbtn')
  offb('main.btntypes?',  'cmd.main_btntypes')
  offb('main.lsain?',     'cmd.main_lsain')
  offb('main.aintypes?',  'cmd.main_aintypes')
  // axis.*
  offb('axis.range',         'cmd.axis_range')
  offb('axis.maxtorque',     'cmd.axis_maxtorque')
  offb('axis.fxratio',       'cmd.axis_fxratio')
  offb('axis.invert',        'cmd.axis_invert')
  offb('axis.ffbinvert',     'cmd.axis_ffbinvert')
  offb('axis.drvtype?',      'cmd.axis_drvtype')
  offb('axis.enctype?',      'cmd.axis_enctype')
  offb('axis.pos?',          'cmd.axis_pos')
  offb('axis.idlespring',    'cmd.axis_idlespring')
  offb('axis.axisdamper',    'cmd.axis_axisdamper')
  offb('axis.axisinertia',   'cmd.axis_axisinertia')
  offb('axis.axisfriction',  'cmd.axis_axisfriction')
  offb('axis.esgain',        'cmd.axis_esgain')
  offb('axis.esdamp',        'cmd.axis_esdamp')
  offb('axis.maxtorquerate', 'cmd.axis_maxtorquerate')
  offb('axis.expo',          'cmd.axis_expo')
  offb('axis.exposcale',     'cmd.axis_exposcale')
  offb('axis.zeroenc!',      'cmd.axis_zeroenc')
  offb('axis.anticogcal!',   'cmd.axis_anticogcal')
  offb('axis.curtorque?',    'cmd.axis_curtorque')
  offb('axis.curpos?',       'cmd.axis_curpos')
  offb('axis.curspd?',       'cmd.axis_curspd')
  offb('axis.curaccel?',     'cmd.axis_curaccel')
  // fx.*
  offb('fx.spring',       'cmd.fx_spring')
  offb('fx.damper',       'cmd.fx_damper')
  offb('fx.friction',     'cmd.fx_friction')
  offb('fx.inertia',      'cmd.fx_inertia')
  offb('fx.master',       'cmd.fx_master')
  offb('fx.filterCfFreq', 'cmd.fx_cf_freq')
  offb('fx.filterCfQ',    'cmd.fx_cf_q')
  offb('fx.filterFrFreq', 'cmd.fx_fr_freq')
  offb('fx.filterFrQ',    'cmd.fx_fr_q')
  offb('fx.filterDaFreq', 'cmd.fx_da_freq')
  offb('fx.filterDaQ',    'cmd.fx_da_q')
  offb('fx.filterInFreq', 'cmd.fx_in_freq')
  offb('fx.filterInQ',    'cmd.fx_in_q')
  // gpio.*
  offb('gpio.mode',   'cmd.gpio_mode')
  offb('gpio.idx',    'cmd.gpio_idx')
  offb('gpio.invert', 'cmd.gpio_invert')
  offb('gpio.amin',   'cmd.gpio_amin')
  offb('gpio.amax',   'cmd.gpio_amax')
  offb('gpio.cur?',   'cmd.gpio_cur')
  // odrv.*
  offb('odrv.vbus?',      'cmd.odrv_vbus')
  offb('odrv.connected?', 'cmd.odrv_connected')
  offb('odrv.canid',      'cmd.odrv_canid')
  offb('odrv.canspd',     'cmd.odrv_canspd')
  offb('odrv.maxtorque',  'cmd.odrv_maxtorque')

  return items
}
