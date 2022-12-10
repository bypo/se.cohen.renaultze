'use strict';

const Homey = require('homey');
const api = require('/lib/api');

module.exports = class RenaultZoeDevice extends Homey.Device {

  async onInit() {
    this.log('RenaultZoeDevice has been initialized for: ', this.getName());

    this.SetCapabilities();

    this.hvacState = 'off';
    this.setCapabilityValue('onoff', false)
    this.registerCapabilityListener('onoff', this.onCapabilityButton.bind(this));
    this.setCapabilityValue('charge_mode', 'always_charging')
    this.registerCapabilityListener('charge_mode', this.onCapabilityPicker.bind(this));

    this.fetchData()
      .catch(err => {
        this.error(err);
      });

    this.pollingInterval = this.homey.setInterval(() => { this.fetchData(); }, 60000);
  }

  SetCapabilities() {
    if (this.hasCapability('charge_mode') === false) {
      this.log('Added charge_mode capabillity ');
      this.addCapability('charge_mode');
    }
    if (this.hasCapability('measure_isHome') === false) {
      this.log('Added measure_isHome capabillity ');
      this.addCapability('measure_isHome');
    }
    if (this.hasCapability('measure_location') === false) {
      this.log('Added measure_location capabillity ');
      this.addCapability('measure_location');
    }
    if (this.hasCapability('measure_location_latitude') === false) {
      this.log('Added measure_location_latitude capabillity ');
      this.addCapability('measure_location_latitude');
    }
    if (this.hasCapability('measure_location_longitude') === false) {
      this.log('Added measure_location_longitude capabillity ');
      this.addCapability('measure_location_longitude');
    }
  }

  async setLocation(result) {
    this.log('-> setLocation run');
    try {
      let lat = result.data.gpsLatitude;
      let lng = result.data.gpsLongitude;
      const HomeyLat = this.homey.geolocation.getLatitude();
      const HomeyLng = this.homey.geolocation.getLongitude();
      const settings = this.getSettings();
      let renaultApi = new api.RenaultApi(settings);
      const setLocation = renaultApi.calculateHome(HomeyLat, HomeyLng, lat, lng);
      await this.setCapabilityValue('measure_isHome', setLocation <= 1);
      await this.setCapabilityValue('measure_location', 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng);
      await this.setCapabilityValue('measure_location_latitude', lat.toString());
      await this.setCapabilityValue('measure_location_longitude', lng.toString());
    } catch (error) {
      this.homey.app.log(error);
    }
  }

  async chargeModeActionRunListener(args, state) {
    this.log('-> chargeModeActionRunListener run');
    const settings = this.getSettings();
    let renaultApi = new api.RenaultApi(settings);
    renaultApi.setChargeMode(args.mode)
      .then(result => {
        this.log(result);
        this.setCapabilityValue('charge_mode', args.mode)
      });
  }

  async onCapabilityPicker(opts) {
    this.log('-> onCapabilityPicker is changeed');
    const settings = this.getSettings();
    let renaultApi = new api.RenaultApi(settings);
    renaultApi.setChargeMode(opts)
      .then(result => {
        this.log(result);
        this.setCapabilityValue('charge_mode', opts)
      });
  }

  async onCapabilityButton(opts) {
    this.log('-> onCapabilityButton is clicked');
    if (opts === true) {
      this.log('Start AC');
      let batterylevel = this.getCapabilityValue('measure_battery');
      if (batterylevel > 24) { // Zoe internal app can not run heater below 40 - we will be a bit nicer
        const settings = this.getSettings();
        let renaultApi = new api.RenaultApi(settings);
        renaultApi.startAC(21)
          .then(result => {
            this.log(result);
            this.setHvacStatus('on');
            this.data = this.homey.setTimeout(() => { this.setHvacStatus('off'); }, 600000);
          })
          .catch((error) => {
            this.log(error);
            this.setHvacStatus('off');
            throw new Error('An error occured when trying to start heater.', error);
          });
      }
      else {
        this.log('Battery level to low o start.');
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
    this.log({ 'oldValue': this.hvacState, 'newValue': status })
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
    this.log(settings);
    let renaultApi = new api.RenaultApi(settings);
    renaultApi.getBatteryStatus()
      .then(result => {
        this.log(result);
        this.setCapabilityValue('measure_battery', result.data.batteryLevel ?? 0);
        this.setCapabilityValue('measure_batteryTemperature', result.data.batteryTemperature ?? 20);
        this.setCapabilityValue('measure_batteryAvailableEnergy', result.data.batteryAvailableEnergy ?? 0);
        this.setCapabilityValue('measure_batteryAutonomy', result.data.batteryAutonomy ?? 0);
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
          chargingRemainingTime = result.data.chargingRemainingTime ?? 0;
          chargingInstantaneousPower = result.data.chargingInstantaneousPower ?? 0;
          if (renaultApi.reportsChargingPowerInWatts()) {
            chargingInstantaneousPower = chargingInstantaneousPower / 1000;
          }
        }
        this.setCapabilityValue('measure_chargingStatus', chargingStatus);
        this.setCapabilityValue('measure_chargingRemainingTime', chargingRemainingTime);
        this.setCapabilityValue('measure_chargingInstantaneousPower', chargingInstantaneousPower);

        renaultApi.getChargeMode()
          .then(result => {
            this.log(result);
            if (result.data.chargeMode === 'scheduled') {
              this.setCapabilityValue('charge_mode', 'schedule_mode')
            }
            else {
              this.setCapabilityValue('charge_mode', 'always_charging')
            }

            renaultApi.getCockpit()
              .then(result => {
                this.log(result);
                this.setCapabilityValue('measure_totalMileage', result.data.totalMileage ?? 0);

                renaultApi.getACStatus()
                  .then(result => {
                    this.log(result);
                    this.setHvacStatus(result.data.hvacStatus);

                    renaultApi.getLocation()
                      .then(result => {
                        this.log(result);
                        this.setLocation(result);
                      })
                      .catch((error) => {
                        this.log(error);
                      });
                  })
                  .catch((error) => {
                    this.log(error);
                  });
              })
              .catch((error) => {
                this.log(error);
              });
          })
          .catch((error) => {
            this.log(error);
          });
      })
      .catch((error) => {
        this.log(error);
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