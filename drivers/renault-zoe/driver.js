'use strict';

const Homey = require('homey');
const api = require('/lib/api');

module.exports = class RenaultZoeDriver extends Homey.Driver {
 
  async onInit() {
    this.log('RenaultZoeDriver has been initialized');
  }

  async onPair(session) {

    let settings = {
      'username': null,
      'password': null,
      'country': 'GB',
      'locale': 'en-GB',
      'accountId': null,
      'vin': null,
      'modelCode': null,
      'model': null,
      'brand': null
    }

    session.setHandler('login', async (data) => {
      this.log('-> enter login');
      if (data.username === '' || data.password === '') {
        return false;
      }
      let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
      settings.username = renaultApi.encrypt(data.username);
      settings.password = renaultApi.encrypt(data.password);
      return await renaultApi.signUp()
        .then(result => {
          console.log('loggedIn');
          console.log(result);
          settings.accountId = result.data.accountId;
          settings.locale = result.data.locale;
          settings.country = result.data.country;
          return true;
        })
        .catch((error) => {
          console.log('loggedInError');
          console.log(error);
          return false;
        });
    });

    session.setHandler('list_devices', async (data) => {
      this.log('-> enter list_devices');
      let renaultApi = new api.RenaultApi(settings, Homey.env.ENCRYPTION_KEY);
      return await renaultApi.getDevices()
        .then(result => {
          console.log('getDevices');
          console.log(result);
          const devices = result.data.map(myDevice => {
            settings.vin = myDevice.vin;
            settings.modelCode = myDevice.modelCode;
            settings.model = myDevice.model;
            settings.brand = myDevice.brand;
            return {
              name: myDevice.brand + ' ' + myDevice.model  +  ' (' + myDevice.vin + ')' ,
              data: {
                id: myDevice.vin,
              },
              settings: settings
            }
          });
          return devices;
        });
    });

  }

}