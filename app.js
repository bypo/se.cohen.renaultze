'use strict';

const Homey = require('homey');

class RenaultZoeApp extends Homey.App {
  async onInit() {
    this.log('se.cohen.renaultze has been initialized');
  }
}

module.exports = RenaultZoeApp;