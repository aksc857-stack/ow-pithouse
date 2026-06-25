// ── ODrive config schema ──────────────────────────────────────────────────────
// Faithful port of the reference odrive-wheel.html SCHEMA for the 5 ODrive tabs.
// Each field carries its full ODrive path, type, protocol and read-only flag.

export type FieldType = 'float' | 'int' | 'bool' | 'enum'
export type FieldProtocol = 'odrv' | 'offb'

export interface SchemaField {
  name: string          // technical leaf name (also the label fallback)
  label?: string        // display label override
  type: FieldType
  path: string          // FULL path used on the wire
  protocol: FieldProtocol
  readonly?: boolean
  opts?: Record<number, string>  // enum options
}

export interface SchemaGroup {
  group: string
  fields: SchemaField[]
}

export interface SchemaSection {
  id: string
  label: string
  groups: SchemaGroup[]
}

// ── Enums (exact from reference) ──────────────────────────────────────────────
export const ENUM_MOTOR_TYPE = { 0: 'HIGH_CURRENT', 2: 'GIMBAL', 3: 'ACIM' }
export const ENUM_CTRL_MODE = { 0: 'VOLTAGE', 1: 'TORQUE', 2: 'VELOCITY', 3: 'POSITION' }
export const ENUM_INPUT_MODE = {
  0: 'INACTIVE', 1: 'PASSTHROUGH', 2: 'VEL_RAMP', 3: 'POS_FILTER',
  4: 'MIX_CHANNELS', 5: 'TRAP_TRAJ', 6: 'TORQUE_RAMP', 7: 'MIRROR', 8: 'TUNING',
}
export const ENUM_STREAM_PROTO = { 0: 'NONE', 1: 'FIBRE', 2: 'ASCII', 3: 'ASCII_AND_STDOUT', 4: 'STDOUT' }
export const ENUM_ENCODER_MODE = {
  0: 'INCREMENTAL', 1: 'HALL', 2: 'SINCOS',
  256: 'SPI_ABS_CUI', 257: 'SPI_ABS_AMS', 258: 'SPI_ABS_AEAT',
  259: 'SPI_ABS_RLS', 260: 'SPI_ABS_MA732', 261: 'SPI_ABS_MT6835',
}

// ── Field builders (prefix-aware) ─────────────────────────────────────────────
const mk = (prefix: string) => ({
  F: (name: string, label?: string): SchemaField => ({ name, label, type: 'float', path: prefix + name, protocol: 'odrv' }),
  I: (name: string, label?: string): SchemaField => ({ name, label, type: 'int', path: prefix + name, protocol: 'odrv' }),
  B: (name: string, label?: string): SchemaField => ({ name, label, type: 'bool', path: prefix + name, protocol: 'odrv' }),
  E: (name: string, opts: Record<number, string>, label?: string): SchemaField => ({ name, label, type: 'enum', opts, path: prefix + name, protocol: 'odrv' }),
  F_RO: (name: string, label?: string): SchemaField => ({ name, label, type: 'float', path: prefix + name, protocol: 'odrv', readonly: true }),
  I_RO: (name: string, label?: string): SchemaField => ({ name, label, type: 'int', path: prefix + name, protocol: 'odrv', readonly: true }),
  // Extended: full path passed directly (lives outside the tab prefix)
  FX: (path: string, label?: string): SchemaField => ({ name: path.split('.').pop()!, label, type: 'float', path, protocol: 'odrv' }),
  IX: (path: string, label?: string): SchemaField => ({ name: path.split('.').pop()!, label, type: 'int', path, protocol: 'odrv' }),
  BX: (path: string, label?: string): SchemaField => ({ name: path.split('.').pop()!, label, type: 'bool', path, protocol: 'odrv' }),
  // OpenFFBoard command shown inside an ODrive tab
  ICMD: (label: string, path: string): SchemaField => ({ name: label, label, type: 'int', path, protocol: 'offb' }),
})

// ── SECTION: PSU / RBrake ─────────────────────────────────────────────────────
const psu = mk('config.')
const PSU: SchemaSection = {
  id: 'psu', label: 'PSU / RBrake',
  groups: [
    { group: 'Alimentation / Brake', fields: [
      psu.F('brake_resistance'),
      psu.B('enable_brake_resistor'),
      psu.F('dc_bus_undervoltage_trip_level'),
      psu.F('dc_bus_overvoltage_trip_level'),
      psu.B('enable_dc_bus_overvoltage_ramp'),
      psu.F('dc_bus_overvoltage_ramp_start'),
      psu.F('dc_bus_overvoltage_ramp_end'),
      psu.F('dc_max_positive_current'),
      psu.F('dc_max_negative_current'),
      psu.F('max_regen_current', 'Regeneration Threshold current'),
      psu.ICMD('vbus_divider', 'sys.vbusdiv'),
    ]},
    { group: 'Communication', fields: [
      psu.B('enable_i2c_a'),
      psu.B('enable_uart_a'),
      psu.B('enable_uart_b'),
      psu.B('enable_uart_c'),
      psu.E('uart0_protocol', ENUM_STREAM_PROTO),
      psu.E('uart1_protocol', ENUM_STREAM_PROTO),
      psu.E('uart2_protocol', ENUM_STREAM_PROTO),
      psu.I('uart_a_baudrate'),
      psu.I('uart_b_baudrate'),
      psu.I('uart_c_baudrate'),
      psu.E('usb_cdc_protocol', ENUM_STREAM_PROTO),
      psu.I('error_gpio_pin'),
    ]},
  ],
}

// ── SECTION: Axis 0 ───────────────────────────────────────────────────────────
const ax = mk('axis0.config.')
const AXIS0: SchemaSection = {
  id: 'axis0', label: 'Axis 0',
  groups: [
    { group: 'Startup Sequence', fields: [
      ax.B('startup_motor_calibration'),
      ax.B('startup_encoder_index_search'),
      ax.B('startup_encoder_offset_calibration'),
      ax.B('startup_closed_loop_control'),
      ax.B('startup_homing'),
    ]},
    { group: 'Mode d\'opération', fields: [
      ax.B('enable_sensorless_mode'),
      ax.B('enable_step_dir'),
      ax.B('step_dir_always_on'),
      ax.I('step_gpio_pin'),
      ax.I('dir_gpio_pin'),
      ax.B('enable_watchdog'),
      ax.F('watchdog_timeout'),
    ]},
    { group: 'Calibration Lockin', fields: [
      ax.F('calibration_lockin.current'),
      ax.F('calibration_lockin.ramp_time'),
      ax.F('calibration_lockin.ramp_distance'),
      ax.F('calibration_lockin.accel'),
      ax.F('calibration_lockin.vel'),
    ]},
    { group: 'General Lockin', fields: [
      ax.F('general_lockin.current'),
      ax.F('general_lockin.ramp_time'),
      ax.F('general_lockin.ramp_distance'),
      ax.F('general_lockin.accel'),
      ax.F('general_lockin.vel'),
      ax.F('general_lockin.finish_distance'),
      ax.B('general_lockin.finish_on_distance'),
      ax.B('general_lockin.finish_on_enc_idx'),
      ax.B('general_lockin.finish_on_vel'),
    ]},
    { group: 'Sensorless Ramp', fields: [
      ax.F('sensorless_ramp.current'),
      ax.F('sensorless_ramp.ramp_time'),
      ax.F('sensorless_ramp.ramp_distance'),
      ax.F('sensorless_ramp.accel'),
      ax.F('sensorless_ramp.vel'),
      ax.F('sensorless_ramp.finish_distance'),
      ax.B('sensorless_ramp.finish_on_distance'),
      ax.B('sensorless_ramp.finish_on_enc_idx'),
      ax.B('sensorless_ramp.finish_on_vel'),
    ]},
  ],
}

// ── SECTION: Motor ────────────────────────────────────────────────────────────
const mo = mk('axis0.motor.config.')
const MOTOR: SchemaSection = {
  id: 'motor', label: 'Motor',
  groups: [
    { group: 'Type / calibration', fields: [
      mo.E('motor_type', ENUM_MOTOR_TYPE),
      mo.I('pole_pairs'),
      mo.F('torque_constant'),
      mo.B('pre_calibrated'),
      mo.F_RO('phase_resistance'),
      mo.F_RO('phase_inductance'),
      mo.F('calibration_current'),
      mo.F('resistance_calib_max_voltage'),
      mo.F('requested_current_range'),
      mo.F('current_control_bandwidth'),
      mo.F('current_control_deadband'),
      mo.F('dc_calib_tau'),
    ]},
    { group: 'Limites', fields: [
      mo.F('current_lim'),
      mo.F('current_lim_margin'),
      mo.F('torque_lim'),
      mo.F('I_bus_hard_min'),
      mo.F('I_bus_hard_max'),
      mo.F('I_leak_max'),
    ]},
    { group: 'Thermistor FET (onboard)', fields: [
      mo.BX('axis0.motor.fet_thermistor.config.enabled', 'enabled'),
      mo.FX('axis0.motor.fet_thermistor.config.temp_limit_lower', 'temp_limit_lower (°C)'),
      mo.FX('axis0.motor.fet_thermistor.config.temp_limit_upper', 'temp_limit_upper (°C)'),
    ]},
    { group: 'Thermistor moteur (NTC offboard)', fields: [
      mo.BX('axis0.motor.motor_thermistor.config.enabled', 'enabled'),
      mo.IX('axis0.motor.motor_thermistor.config.gpio_pin', 'GPIO pin (ANALOG_IN)'),
      mo.FX('axis0.motor.motor_thermistor.config.temp_limit_lower', 'temp_limit_lower (°C)'),
      mo.FX('axis0.motor.motor_thermistor.config.temp_limit_upper', 'temp_limit_upper (°C)'),
      mo.FX('axis0.motor.motor_thermistor.config.poly_coefficient_0', 'Polynomial c0'),
      mo.FX('axis0.motor.motor_thermistor.config.poly_coefficient_1', 'Polynomial c1'),
      mo.FX('axis0.motor.motor_thermistor.config.poly_coefficient_2', 'Polynomial c2'),
      mo.FX('axis0.motor.motor_thermistor.config.poly_coefficient_3', 'Polynomial c3'),
    ]},
    { group: 'Feed-forward', fields: [
      mo.B('R_wL_FF_enable'),
      mo.B('bEMF_FF_enable'),
    ]},
    { group: 'ACIM (induction only)', fields: [
      mo.F('acim_gain_min_flux'),
      mo.B('acim_autoflux_enable'),
      mo.F('acim_autoflux_min_Id'),
      mo.F('acim_autoflux_attack_gain'),
      mo.F('acim_autoflux_decay_gain'),
    ]},
  ],
}

// ── SECTION: Encoder ──────────────────────────────────────────────────────────
const en = mk('axis0.encoder.config.')
const ENCODER: SchemaSection = {
  id: 'encoder', label: 'Encoder',
  groups: [
    { group: 'Mode / résolution', fields: [
      en.E('mode', ENUM_ENCODER_MODE),
      en.I('cpr'),
      en.I_RO('direction'),
      en.F('bandwidth'),
      en.B('pre_calibrated'),
      en.I_RO('phase_offset'),
      en.F_RO('phase_offset_float'),
      en.B('enable_phase_interpolation'),
    ]},
    { group: 'Index / offset', fields: [
      en.B('use_index'),
      en.B('use_index_offset'),
      en.F('index_offset'),
      en.B('find_idx_on_lockin_only'),
    ]},
    { group: 'Calibration', fields: [
      en.F('calib_range'),
      en.F('calib_scan_distance'),
      en.F('calib_scan_omega'),
    ]},
    { group: 'Hall', fields: [
      en.I('hall_polarity'),
      en.B('hall_polarity_calibrated'),
      en.B('ignore_illegal_hall_state'),
    ]},
    { group: 'Pins', fields: [
      en.I('abs_spi_cs_gpio_pin'),
      en.I('sincos_gpio_pin_sin'),
      en.I('sincos_gpio_pin_cos'),
    ]},
  ],
}

// ── SECTION: Controller ───────────────────────────────────────────────────────
const ct = mk('axis0.controller.config.')
const CONTROLLER: SchemaSection = {
  id: 'controller', label: 'Controller',
  groups: [
    { group: 'Mode de contrôle', fields: [
      ct.E('control_mode', ENUM_CTRL_MODE),
      ct.E('input_mode', ENUM_INPUT_MODE),
      ct.F('input_filter_bandwidth'),
      ct.F('torque_ramp_rate'),
      ct.F('vel_ramp_rate'),
    ]},
    { group: 'Gains (PID)', fields: [
      ct.F('pos_gain'),
      ct.F('vel_gain'),
      ct.F('vel_integrator_gain'),
      ct.F('vel_integrator_limit'),
      ct.F('inertia'),
      ct.B('enable_gain_scheduling'),
      ct.F('gain_scheduling_width'),
    ]},
    { group: 'Limites de vitesse', fields: [
      ct.B('enable_vel_limit'),
      ct.B('enable_torque_mode_vel_limit'),
      ct.F('vel_limit'),
      ct.F('vel_limit_tolerance'),
      ct.B('enable_overspeed_error'),
    ]},
    { group: 'Position circulaire', fields: [
      ct.B('circular_setpoints'),
      ct.F('circular_setpoint_range'),
      ct.I('steps_per_circular_range'),
    ]},
    { group: 'Homing / mirror', fields: [
      ct.F('homing_speed'),
      ct.I('load_encoder_axis'),
      ct.I('axis_to_mirror'),
      ct.F('mirror_ratio'),
      ct.F('torque_mirror_ratio'),
    ]},
    { group: 'Power monitoring', fields: [
      ct.F('electrical_power_bandwidth'),
      ct.F('mechanical_power_bandwidth'),
      ct.F('spinout_electrical_power_threshold'),
      ct.F('spinout_mechanical_power_threshold'),
    ]},
    { group: 'Anticogging', fields: [
      ct.B('anticogging.anticogging_enabled'),
      ct.B('anticogging.pre_calibrated'),
      ct.F('anticogging.cogging_ratio'),
      ct.F('anticogging.calib_pos_threshold'),
      ct.F('anticogging.calib_vel_threshold'),
      ct.I('anticogging.index'),
    ]},
  ],
}

export const ODRIVE_SECTIONS: SchemaSection[] = [PSU, AXIS0, MOTOR, ENCODER, CONTROLLER]
