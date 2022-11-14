'use strict';

const Homey = require('homey');

class RenaultZoeApp extends Homey.App {
  async onInit() {
    this.log('se.cohen.renaultze has been initialized');

    // Actions
    this.chargeModeAction = this.homey.flow.getActionCard('set_charge_mode')
      .registerRunListener((args, state) => { return args.device.chargeModeActionRunListener(args, state); });

    // Conditions
    const isCharging = this.homey.flow.getConditionCard('is_charging');
		isCharging.registerRunListener((args) => args.device.getCapabilityValue('measure_chargingStatus'));
    
    const isPluggedIn = this.homey.flow.getConditionCard('is_pluggedIn');
		isCharging.registerRunListener((args) => args.device.getCapabilityValue('measure_plugStatus'));

  }
}

module.exports = RenaultZoeApp;