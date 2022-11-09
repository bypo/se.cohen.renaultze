'use strict';

const Homey = require('homey');
const api = require('/lib/api');

module.exports = class RenaultZoeDevice extends Homey.Device {

  async onInit() {
    this.log('RenaultZoeDevice has been initialized for: ', this.getName());
    
    if (this.hasCapability('charge_mode') === false) {
      this.log('Added charge_mode capabillity ')
      await this.addCapability('charge_mode');
    }
    
    this.hvacState = 'off';
    this.setCapabilityValue('onoff', false)
    this.registerCapabilityListener('onoff', this.onCapabilityButton.bind(this));
    this.setCapabilityValue('charge_mode', 'always_charging')
    this.registerCapabilityListener('charge_mode', this.onCapabilityPicker.bind(this));
    
    this.fetchData()
      .catch(err => {
        this.error(err);
      });

    this.pollingInterval = this.homey.setInterval(() => { this.fetchData(); }, 200000);
  }

  async chargeModeActionRunListener(args, state) {
    this.log('-> chargeModeActionRunListener is run');
    const settings = this.getSettings();
    let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
    renaultApi.setChargeMode(args.mode)
    .then(result => {
      console.log(result);
      this.setCapabilityValue('charge_mode', args.mode)
    });
  }

  async onCapabilityPicker(opts) {
    this.log('-> onCapabilityPicker is changeed');
    const settings = this.getSettings();
    let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
    renaultApi.setChargeMode(opts)
      .then(result => {
        console.log(result);
        this.setCapabilityValue('charge_mode', opts)
        this.homey.flow.getDeviceTriggerCard('charge_mode_change')
          .trigger(this, null)
          .catch(this.error);
      });
  }

  async onCapabilityButton(opts) {
    this.log('-> onCapabilityButton is clicked');
    if (opts === true) {
      this.log('Start AC');
      let batterylevel = this.getCapabilityValue('measure_battery');
      if (batterylevel > 24) { // Zoe internal app can not run heater below 40 - we will be a bit nicer
        const settings = this.getSettings();
        let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
        renaultApi.startAC(21)
          .then(result => {
            console.log(result);
            this.setHvacStatus('on');
            this.data = this.homey.setTimeout(() => { this.setHvacStatus('off'); }, 600000);
          })
          .catch((error) => {
            console.log(error);
            this.setHvacStatus('off');
            throw new Error('An error occured when trying to start heater.', error);
          });
      }
      else {
        console.log('Battery level to low o start.');
        this.setHvacStatus('off');
        throw new Error('Your car need some more charging before using heater, not started 25% is needed).');
      }
    }
    else {
      this.log('Stop AC');
      this.setHvacStatus('on');
      throw new Error('There is no way to stop a stated heater session on current Zoe implementation.');
    }
  }

  setHvacStatus(status) {
    this.log('-> setHvacStatus');
    console.log({ 'oldValue': this.hvacState, 'newValue': status })
    this.hvacState = status;
    if (status === 'on') {
      this.setCapabilityValue('onoff', true)
    }
    else {
      this.setCapabilityValue('onoff', false)
    }
  }

  async fetchData() {
    this.log('-> enter fetchCarData');
    const settings = this.getSettings();
    let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
    renaultApi.getBatteryStatus()
      .then(result => {
        console.log(result);
        this.setCapabilityValue('measure_battery', result.data.batteryLevel);
        this.setCapabilityValue('measure_batteryTemperature', result.data.batteryTemperature);
        this.setCapabilityValue('measure_batteryAvailableEnergy', result.data.batteryAvailableEnergy);
        this.setCapabilityValue('measure_batteryAutonomy', result.data.batteryAutonomy);
        let plugStatus = false;
        if (result.data.plugStatus === 1) {
          plugStatus = true;
        }
        this.setCapabilityValue('measure_plugStatus', plugStatus);
        let chargingRemainingTime = 0;
        let chargingInstantaneousPower = 0;
        let chargingStatus = false;
        if (result.data.chargingStatus === 1) {
          chargingStatus = true;
          chargingRemainingTime = result.data.chargingRemainingTime;
          chargingInstantaneousPower = result.data.chargingInstantaneousPower;
          if (renaultApi.reportsChargingPowerInWatts()) {
            chargingInstantaneousPower = chargingInstantaneousPower / 1000;
          }
        }
        this.setCapabilityValue('measure_chargingStatus', chargingStatus);
        this.setCapabilityValue('measure_chargingRemainingTime', chargingRemainingTime);
        this.setCapabilityValue('measure_chargingInstantaneousPower', chargingInstantaneousPower);
      })
      .catch((error) => {
        console.log(error);
      });
    renaultApi.getCockpit()
      .then(result => {
        console.log(result);
        this.setCapabilityValue('measure_totalMileage', result.data.totalMileage);
      })
      .catch((error) => {
        console.log(error);
      });
    renaultApi.getACStatus()
      .then(result => {
        console.log(result);
        this.setHvacStatus(result.data.hvacStatus);
      })
      .catch((error) => {
        console.log(error);
      });
    renaultApi.getChargeMode()
      .then(result => {
        console.log(result);
        if (result.data.chargeMode === 'scheduled') {
          this.setCapabilityValue('charge_mode', 'schedule_mode')
        }
        else {
          this.setCapabilityValue('charge_mode', 'always_charging')
        }
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async onAdded() {
    this.log('MyDevice has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('MyDevice settings where changed');
  }

  async onRenamed(name) {
    this.log('MyDevice was renamed');
  }

  async onDeleted() {
    this.log('MyDevice has been deleted');
    clearInterval(this.pollingInterval);
  }
}