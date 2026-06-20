// ── Liste des commandes disponibles ───────────────────────────────────────────
// Source combinée, fidèle à la version odrive-wheel.html :
//   1. ODrive ASCII fondamentaux (r/w/ss/sr/sc/sd…)
//   2. Propriétés du schéma (tous les paths ODrive configurables → r/w)
//   3. Commandes OpenFFBoard cmdparser (axis.*, fx.*, sys.*, gpio.*, odrv.*)

import { ODRIVE_SECTIONS } from './odriveSchema'

export type CmdGroup = 'odrv' | 'paths' | 'offb'
export interface CmdItem { grp: CmdGroup; cmd: string; desc: string }

export const GROUP_LABELS: Record<CmdGroup, string> = {
  odrv:  'ODrive ASCII',
  paths: 'Propriétés (schéma)',
  offb:  'OpenFFBoard (cmdparser)',
}

export function buildCommandList(): CmdItem[] {
  const items: CmdItem[] = []

  // ── 1. ODrive ASCII fondamentaux ──────────────────────────────────────────
  items.push(
    { grp: 'odrv', cmd: 'r ',         desc: 'Lire une propriété — compléter avec le path' },
    { grp: 'odrv', cmd: 'w  ',        desc: 'Écrire une propriété — path + valeur' },
    { grp: 'odrv', cmd: 'ss',         desc: 'Save config en NVM' },
    { grp: 'odrv', cmd: 'sr',         desc: 'Reboot' },
    { grp: 'odrv', cmd: 'sc',         desc: 'Clear errors sur tous les axes' },
    { grp: 'odrv', cmd: 'sd',         desc: 'Soft DFU — bootloader sans BOOT0' },
    { grp: 'odrv', cmd: 'se',         desc: 'Erase config (factory reset)' },
    { grp: 'odrv', cmd: 'f 0',        desc: 'Feed watchdog — axe 0' },
    { grp: 'odrv', cmd: 't 0 ',       desc: 'Trapezoidal move — t <axe> <pos>' },
    { grp: 'odrv', cmd: 'q 0  10',    desc: 'Input pos filtered — q <axe> <pos> <vel_lim>' },
    { grp: 'odrv', cmd: 'p 0 0 0 0',  desc: 'Pos setpoint — p <axe> <pos> <vel_ff> <torque_ff>' },
    { grp: 'odrv', cmd: 'v 0 0 0',    desc: 'Vel setpoint — v <axe> <vel> <torque_ff>' },
    { grp: 'odrv', cmd: 'c 0 0',      desc: 'Torque setpoint — c <axe> <torque_Nm>' },
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
        items.push({ grp: 'paths', cmd: 'r ' + f.path, desc: 'Read ' + leaf })
        items.push({ grp: 'paths', cmd: 'w ' + f.path + ' ', desc: 'Write ' + leaf })
      }
    }
  }

  // ── 3. OpenFFBoard cmdparser — miroir de cmd_table.cpp ──────────────────────
  const offb = (cmd: string, desc: string) => items.push({ grp: 'offb', cmd, desc })
  // sys.*
  offb('sys.lsmain?',    'Liste les mainclasses disponibles')
  offb('sys.lsactive?',  'Mainclass active')
  offb('sys.heapfree?',  'Heap libre (FreeRTOS)')
  offb('sys.cmdinfo?',   'Info statique de la commande')
  offb('sys.temp?',      'Température interne du MCU')
  offb('sys.swver?',     'Version du firmware')
  offb('sys.hwtype?',    'Type de hardware')
  offb('sys.uid?',       'Unique ID du STM32')
  offb('sys.signature?', 'Signature word')
  offb('sys.debug?',     'Dump des variables debug')
  offb('sys.main?',      'ID de la mainclass courante')
  offb('sys.devid?',     'Device + revision ID')
  offb('sys.errors?',    'Liste des erreurs')
  offb('sys.errorsclr!', 'Efface les erreurs')
  offb('sys.format!',    'Erase config (factory reset)')
  offb('sys.flashdump?', 'Dump des vars flash (NVM)')
  offb('sys.vint?',      'VBUS interne en mV')
  offb('sys.vext?',      'Tension externe')
  offb('sys.heap?',      'Heap libre')
  offb('sys.save!',      'Persiste la config en flash')
  offb('sys.savestat?',  'Diagnostic du dernier save')
  offb('sys.eetest!',    'Test bas-niveau EEPROM')
  offb('sys.eedump?',    'Dump raw EEPROM')
  offb('sys.eeformat!',  '⚠ Force format EEPROM (escape hatch)')
  offb('sys.vbusdiv',    'Diviseur de tension VBUS (1-50, défaut 19 MKS)')
  offb('sys.reboot!',    'Reset du chip')
  offb('sys.uptime?',    'Uptime en ms')
  offb('sys.ping?',      'Ping (réponse attendue : OK)')
  offb('sys.fxtest?',    'Test du ratio d\'effets')
  // main.*
  offb('main.id?',        'ID de la FFB Wheel')
  offb('main.hidrate?',   'Taux de HID input report')
  offb('main.cfrate?',    'Taux de mise à jour constant-force')
  offb('main.ffbactive?', 'État FFB (actif/inactif)')
  offb('main.hidsendspd', 'Vitesse d\'envoi HID')
  offb('main.errors?',    'Erreurs de la mainclass')
  offb('main.lsbtn?',     'Liste des boutons configurés')
  offb('main.btntypes?',  'Types de boutons disponibles')
  offb('main.lsain?',     'Liste des entrées analogiques')
  offb('main.aintypes?',  'Types d\'entrées analogiques')
  // axis.*
  offb('axis.range',         'Range du volant en counts')
  offb('axis.maxtorque',     'Maxtorque (limite finale du FFB)')
  offb('axis.fxratio',       'Effect ratio (0-255)')
  offb('axis.invert',        '0/1 — inverse la position HID')
  offb('axis.ffbinvert',     '0/1 — inverse le couple FFB')
  offb('axis.drvtype?',      'Type de driver courant')
  offb('axis.enctype?',      'Type d\'encodeur courant')
  offb('axis.pos?',          'Position courante en counts')
  offb('axis.idlespring',    'Mola jeu éteint / centrage (0-255)')
  offb('axis.axisdamper',    'Damper toujours actif (0-255)')
  offb('axis.axisinertia',   'Inertia toujours active (0-255)')
  offb('axis.axisfriction',  'Friction toujours active (0-255)')
  offb('axis.esgain',        'End-stop — force du ressort (0-255)')
  offb('axis.esdamp',        'End-stop — amortissement (0-255)')
  offb('axis.maxtorquerate', 'Slew limit (counts/ms, 0=off)')
  offb('axis.expo',          'Courbe exponentielle (-32767..32767)')
  offb('axis.exposcale',     'Diviseur de l\'expo (1-255)')
  offb('axis.zeroenc!',      'Remet à zéro la position courante')
  offb('axis.anticogcal!',   'Lance l\'anticogging calibration')
  offb('axis.curtorque?',    'Live : couple actuel')
  offb('axis.curpos?',       'Live : position actuelle')
  offb('axis.curspd?',       'Live : vitesse actuelle')
  offb('axis.curaccel?',     'Live : accélération actuelle')
  // fx.*
  offb('fx.spring',       'Spring gain (0-255)')
  offb('fx.damper',       'Damper gain (0-255)')
  offb('fx.friction',     'Friction gain (0-255)')
  offb('fx.inertia',      'Inertia gain (0-255)')
  offb('fx.master',       'Master gain (global_gain)')
  offb('fx.filterCfFreq', 'Filtre Constant Force — fréquence')
  offb('fx.filterCfQ',    'Filtre Constant Force — Q')
  offb('fx.filterFrFreq', 'Filtre Friction — fréquence')
  offb('fx.filterFrQ',    'Filtre Friction — Q')
  offb('fx.filterDaFreq', 'Filtre Damper — fréquence')
  offb('fx.filterDaQ',    'Filtre Damper — Q')
  offb('fx.filterInFreq', 'Filtre Inertia — fréquence')
  offb('fx.filterInQ',    'Filtre Inertia — Q')
  // gpio.*
  offb('gpio.mode',   'GPIO mode (0=off / 1=button / 2=axis)')
  offb('gpio.idx',    'GPIO index (0-63 bouton, 0-3 axe)')
  offb('gpio.invert', 'GPIO invert (0/1)')
  offb('gpio.amin',   'GPIO axis min raw (0-4095)')
  offb('gpio.amax',   'GPIO axis max raw (0-4095)')
  offb('gpio.cur?',   'GPIO raw courant (debug/UI)')
  // odrv.*
  offb('odrv.vbus?',      'VBUS courant (volts)')
  offb('odrv.connected?', 'État de connexion')
  offb('odrv.canid',      'CAN ID')
  offb('odrv.canspd',     'CAN speed')
  offb('odrv.maxtorque',  'Maxtorque limite finale du hw')

  return items
}
