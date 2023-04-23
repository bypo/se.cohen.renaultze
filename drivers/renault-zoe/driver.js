'use strict';

const Homey = require('homey');
const api = require('../../lib/api');

module.exports = class RenaultZoeDriver extends Homey.Driver {
 
  async onInit() {
    this.log('RenaultZoeDriver has been initialized');
  }

  async onPair(session) {

    let settings = {
      username: null,
      password: null,
      country: 'GB',
      locale: 'en-GB',
      accountId: null,
      vin: null,
      modelCode: null,
      model: null,
      brand: null
    }

    session.setHandler('login', async (data) => {
      this.log('-> enter login');
      if (data.username === '' || data.password === '') {
        return false;
      }
      let renaultApi = new api.RenaultApi(settings);
      settings.username = renaultApi.encrypt(data.username);
      settings.password = renaultApi.encrypt(data.password);
      return await renaultApi.signUp()
        .then(result => {
          this.log('loggedIn');
          this.log(result);
          settings.accountId = result.data.accountId;
          settings.locale = result.data.locale;
          settings.country = result.data.country;
          return true;
        })
        .catch((error) => {
          this.log('loggedInError');
          this.log(error);
          return false;
        });
    });

    session.setHandler('list_devices', async (data) => {
      this.log('-> enter list_devices');
      let renaultApi = new api.RenaultApi(settings);
      return await renaultApi.getDevices()
        .then(result => {
          this.log('getDevices');
          this.log(result);
          const devices = result.data.map(myDevice => {
            return {
              name: myDevice.brand + ' ' + myDevice.model  +  ' (' + myDevice.vin + ')' ,
              data: {
                id: myDevice.vin,
              },
              settings: {
                username: settings.username,
                password: settings.password,
                country: settings.country,
                locale: settings.locale,
                accountId: settings.accountId,
                vin: myDevice.vin,
                modelCode: myDevice.modelCode,
                model: myDevice.model,
                brand: myDevice.brandull
              }
            }
          });
          return devices;
        });
    });

  }

}