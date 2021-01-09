'use strict';

const Homey = require('homey');
const api = require('/lib/api');

class RenaultZoeDriver extends Homey.Driver {
  async onInit() {
    this.log('RenaultZoeDriver has been initialized');
  }

  onPair(socket) {

    let settings = {
      'username': null,
      'password': null,
      'country': 'GB',
      'locale': 'en-GB',
      'accountId': null,
      'vin': null
    }

    socket.on('login', (data, callback) => {

      this.log('-> enter login');

      if (data.username === '' || data.password === '') {
        return callback(null, false);
      }

      settings.username = data.username;
      settings.password = data.password;

      let renaultApi = new api.RenaultApi(settings);

      renaultApi.signUp()
        .then(result => {
          console.log('loggedIn');
          console.log(result);
          // set collected data
          settings.accountId = result.data.accountId;
          settings.locale = result.data.locale;
          settings.country = result.data.country;
          callback(null, true);
        })
        .catch((error) => {
          console.log('loggedInError');
          console.log(error);
          callback(null, false);
        });
    });

    socket.on('list_devices', (data, callback) => {

      this.log('-> enter list_devices');

      let renaultApi = new api.RenaultApi(settings);

      renaultApi.getDevices()
        .then(result => {
          console.log('getDevices');
          console.log(result);
          // set collected data
          const devices = result.data.map(myDevice => {
            settings.vin = myDevice.vin;
            return {
              name: "My Renault ZOE",
              data: {
                id: myDevice.vin,
              },
              settings: settings
            }
          });
          callback(null, devices); 
        })
        .catch((error) => {
          console.log('getDevicesError');
          console.log(error);
          callback(new Error('Something bad has occured, we could not list your devices!'));
        });
    });
  }

}

module.exports = RenaultZoeDriver;