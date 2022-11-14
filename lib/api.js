'use strict';

const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const crypto_algorithm = 'aes-256-ctr';

class RenaultApi {

    constructor(settings, encryptionKey) {
        this.settings = settings;
        this.encryptionKey = encryptionKey;
        this.configuration = configurations.find(el => el.country_string === this.settings.locale.replace('-', '_'))
    }

    // ****************************************************************************
    // Public 
    // ****************************************************************************

    encrypt(text) {
        if (!this.encryptionKey || this.encryptionKey === "") {
            console.log('Encryption key not found!');
            return text;
        }
        let iv = crypto.randomBytes(16);
        let cipher = crypto.createCipheriv(crypto_algorithm, Buffer.from(this.encryptionKey), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
    }

    decrypt(encryptedJson) {
        if (!encryptedJson.iv) {
            return encryptedJson;
        }
        let iv = Buffer.from(encryptedJson.iv, 'hex');
        let encryptedText = Buffer.from(encryptedJson.encryptedData, 'hex');
        let decipher = crypto.createDecipheriv(crypto_algorithm, Buffer.from(this.encryptionKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    calculateHome (lat1, lon1, lat2, lon2) {
        console.log(lat1);
        console.log(lon1);
        console.log(lat2);
        console.log(lon2);
        let R = 6371; // km
        let dLat = this.toRad(lat2 - lat1);
        let dLon = this.toRad(lon2 - lon1);
        lat1 = this.toRad(lat1);
        lat2 = this.toRad(lat2);
        let a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2) *
          Math.cos(lat1) *
          Math.cos(lat2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let d = R * c;
        return d.toFixed(1);
      };
      
      toRad($Value) {
        return ($Value * Math.PI) / 180;
      }



    reportsChargingPowerInWatts() {
        const modelCode = this.settings.modelCode;
        console.log('reportsChargingPowerInWatts: ' + modelCode);
        if (modelCode === 'X101VE') {
            return true;
        }
        return false;
    }

    supportEndpointHvacStatus() {
        const modelCode = this.settings.modelCode;
        console.log('supportEndpointHvacStatus: ' + modelCode);
        if (modelCode === 'X101VE') {
            return true;
        }
        return false;
    }

    supportEndpointLocation() {
        const modelCode = this.settings.modelCode;
        console.log('supportEndpointLocation: ' + modelCode);
        if (modelCode === 'X102VE') {
            return true;
        }
        return false;
    }

    async signUp() {

        /*
            {
                status: 'ok',
                data: {
                    country: 'SE',
                    locale: 'sv-SE',
                    accountId: '55cc7a4d-28a4-4a66-bda8-13e3c4727a88'
                }
            }
        */

        console.log('signUp() start');

        const self = this;

        let login_token;
        let person_id;
        let id_token;

        return self._gigyaLogin()
            .then(res1 => {
                login_token = res1.login_token;
                return self._gigyaGetAccountInfo(login_token);
            })
            .then(res2 => {
                person_id = res2.personId;
                return self._gigyaGetJWT(login_token);
            })
            .then(res3 => {
                id_token = res3.id_token
                return self._kamereonGetPerson(id_token, person_id);
            });
    }

    async getDevices() {

        /* 
            { status: 'ok', data: [ { vin: 'VF1AG000166767500' } ] }
        */

        console.log('getDevices() start');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGetVehicles(res);
            });
    }

    async getBatteryStatus() {

        /* 
            {
                status: 'ok',
                data: {
                    id: 'VF1AG000166767500',
                    timestamp: '2020-12-28T11:58:50Z',
                    batteryLevel: 61,
                    batteryTemperature: 20,
                    batteryAutonomy: 137,
                    batteryCapacity: 0,
                    batteryAvailableEnergy: 29,
                    plugStatus: 0,
                    chargingStatus: 0,
                    chargingRemainingTime: 30,
                    chargingInstantaneousPower: 0
                }
            }
        */

        console.log('getBatteryStatus() start');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGet(res, "battery-status", 2);
            });
    }

    async getCockpit() {

        /*
            {
                status: 'ok',
                data: {
                    id: 'VF1AG000166767500',
                    fuelAutonomy: 0,
                    fuelQuantity: 0,
                    totalMileage: 763.28
                }
            }
        */

        console.log('getCcockpit() start');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGet(res, "cockpit", 2);
            });

    }

    async getACStatus() {
        /*
          return: AC object
        */

        console.log('getACStatus() start');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGet(res, "hvac-status", 1);
            });
    }


    async startAC(temp) {

        // return:  AC object

        console.log('startAC() start');

        const self = this;

        let body = {
            "data": {
                "type": "HvacStart",
                "attributes": {
                    "action": "start",
                    "targetTemperature": temp
                }
            }
        };

        return self._getIdToken()
            .then(res => {
                return self._kamereonPost(res, "actions/hvac-start", body, 1);
            });
    }

    async stopAC() {

        // return:  AC object

        console.log('stopAC() start');

        const self = this;

        let body = {
            "data": {
                "type": "HvacStart",
                "attributes": {
                    "action": "cancel"
                }
            }
        };

        return self._getIdToken()
            .then(res => {
                return self._kamereonPost(res, "actions/hvac-start", body, 1);
            });
    }

    async getLocation() {
        /*
        {
            "data": {
                "type": "Car",
                "id": "VF1AG000164767503",
                "attributes": {
                    "gpsLongitude": 18.46149,
                    "gpsLatitude": 59.3125725,
                    "gpsDirection": null,
                    "lastUpdateTime": "2022-11-12T14:47:32Z"
                }
            }
        }
        */

        console.log('gegetLocationtChargeMode()');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGet(res, "location", 1);
            });
    }

    async getChargeMode() {
        /*
          return: charge mode object
        */

        console.log('getChargeMode()');

        const self = this;

        return self._getIdToken()
            .then(res => {
                return self._kamereonGet(res, "charge-mode", 1);
            });
    }

    async setChargeMode(mode) {

        // return: charge mode  object

        console.log('setChargeMode()');

        const self = this;

        let body = {
            "data": {
                "type": "ChargeMode",
                "attributes": {
                    "action": mode
                }
            }
        };

        return self._getIdToken()
            .then(res => {
                return self._kamereonPost(res, "actions/charge-mode", body, 1);
            });
    }

    // ****************************************************************************
    // Private global 
    // ****************************************************************************

    async _getIdToken() {

        // use to check and get id_token for normal use, if one is sent in just return it...

        // TODO: add logic to handle /reuse token

        const self = this;

        return self._gigyaLogin()
            .then(res1 => {
                return self._gigyaGetJWT(res1.login_token);
            })
            .then(res2 => {
                return res2.id_token;
            });
    }

    // ****************************************************************************
    // Private Gigya 
    // ****************************************************************************

    async _gigyaLogin() {

        // return: sessionInfo.cookieValue
        // use for:
        // gigya accounts.getAccountInfo
        // gigya accounts.getJWT

        const self = this;

        return axios.post(
            self.configuration.gigya_url + '/accounts.login',
            querystring.stringify({ ApiKey: self.configuration.gigya_api_key, loginID: self.decrypt(self.settings.username), password: self.decrypt(self.settings.password) }))
            .then(response => {
                if (response.data.statusCode === 200) {
                    return ({ status: "ok", login_token: response.data.sessionInfo.cookieValue });
                }
                else {
                    throw (response.data.statusReason)
                };
            });
    }

    async _gigyaGetAccountInfo(login_token) {

        // return : data.personId
        // use for:
        // kamereon persons

        const self = this;

        return axios.get(
            self.configuration.gigya_url + '/accounts.getAccountInfo',
            { params: { ApiKey: self.configuration.gigya_api_key, login_token: login_token } })
            .then(response => {
                if (response.data.statusCode === 200) {
                    return ({ status: "ok", personId: response.data.data.personId });
                }
                else {
                    throw (response.data.statusReason);
                }
            });
    }

    async _gigyaGetJWT(login_token) {

        // return: id_token
        // use for:
        // all calls to kamereon, timeout 900

        const self = this;

        return axios.post(
            self.configuration.gigya_url + '/accounts.getJWT',
            querystring.stringify({ ApiKey: self.configuration.gigya_api_key, login_token: login_token, fields: "data.personId,data.gigyaDataCenter", expiration: 900 }))
            .then(response => {
                if (response.data.statusCode === 200) {
                    return ({ status: "ok", id_token: response.data.id_token });
                }
                else {
                    throw (response.data.statusReason);
                }
            });
    }

    // ****************************************************************************
    // Private Kamereon 
    // ****************************************************************************

    async _kamereonGetPerson(id_token, person_id) {

        const self = this;

        return axios.get(
            self.configuration.kamereon_url + '/commerce/v1/persons/' + person_id, {
            headers: {
                'x-gigya-id_token': id_token,
                'apikey': self.configuration.kamereon_api_key
            }
        })
            .then(response => {
                let f = response.data.accounts.find(function (account, index) {
                    if (account.accountType === 'MYRENAULT')
                        return true;
                });
                if (f === undefined) {
                    throw ("No account found");
                }
                let data = {
                    country: response.data.country,
                    locale: response.data.locale,
                    accountId: f.accountId,
                };
                return ({ status: "ok", data: data });
            });
    }

    async _kamereonGetVehicles(id_token) {

        const self = this;

        return axios.get(
            self.configuration.kamereon_url + '/commerce/v1/accounts/' + self.settings.accountId + "/vehicles?country=" + self.settings.country, {
            headers: {
                'x-gigya-id_token': id_token,
                'apikey': self.configuration.kamereon_api_key
            }
        })
            .then(response => {
                // vehicleDetails.model.code : "X102VE"
                let vins = response.data.vehicleLinks.map(item => {
                    return {
                        vin: item.vin,
                        modelCode: item.vehicleDetails.model.code,
                        brand: item.vehicleDetails.brand.label,
                        model: item.vehicleDetails.model.label
                    }
                });
                return ({ status: "ok", data: vins })
            });
    }

    async _kamereonGet(id_token, path, version) {

        const self = this;

        return axios.get(
            self.configuration.kamereon_url + '/commerce/v1/accounts/' + self.settings.accountId + "/kamereon/kca/car-adapter/v" + version + "/cars/" + self.settings.vin + "/" + path + "?country=" + self.settings.country, {
            headers: {
                'x-gigya-id_token': id_token,
                'apikey': self.configuration.kamereon_api_key
            }
        })
            .then(response => {
                return ({ status: "ok", data: response.data });
            });
    }

    async _kamereonPost(id_token, path, data, version) {

        const self = this;

        return axios.post(
            self.configuration.kamereon_url + '/commerce/v1/accounts/' + self.settings.accountId + "/kamereon/kca/car-adapter/v" + version + "/cars/" + self.settings.vin + "/" + path + "?country=" + self.settings.country,
            data, {
            headers: {
                'Content-type': 'application/vnd.api+json',
                'x-gigya-id_token': id_token,
                'apikey': self.configuration.kamereon_api_key
            }
        })
            .then(response => {
                return ({ status: "ok", data: response.data });
            });
    }

}

// ****************************************************************************
// Static stores
// ****************************************************************************

 // https://renault-wrd-prod-1-euw1-myrapp-one.s3-eu-west-1.amazonaws.com/configuration/android/config_en_GB.json
 


const configurations = [{
    "country_id": 1,
    "country_string": "bg_BG",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3__3ER_6lFvXEXHTP_faLtq6eEdbKDXd9F5GoKwzRyZq37ZQ-db7mXcLzR1Jtls5sn",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 2,
    "country_string": "cs_CZ",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_oRlKr5PCVL_sPWUZdJ8c5NOl5Ej8nIZw7VKG7S9Rg36UkDszFzfHfxCaUAUU5or2",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 3,
    "country_string": "da_DK",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_5x-2C8b1R4MJPQXkwTPdIqgBpcw653Dakw_ZaEneQRkTBdg9UW9Qg_5G-tMNrTMc",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 4,
    "country_string": "de_DE",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_7PLksOyBRkHv126x5WhHb-5pqC1qFR8pQjxSeLB6nhAnPERTUlwnYoznHSxwX668",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 5,
    "country_string": "de_AT",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3__B4KghyeUb0GlpU62ZXKrjSfb7CPzwBS368wioftJUL5qXE0Z_sSy0rX69klXuHy",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 6,
    "country_string": "de_CH",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_UyiWZs_1UXYCUqK_1n7l7l44UiI_9N9hqwtREV0-UYA_5X7tOV-VKvnGxPBww4q2",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 7,
    "country_string": "en_GB",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_e8d4g4SE_Fo8ahyHwwP7ohLGZ79HKNN2T8NjQqoNnk6Epj6ilyYwKdHUyCw3wuxz",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 8,
    "country_string": "en_IE",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_Xn7tuOnT9raLEXuwSI1_sFFZNEJhSD0lv3gxkwFtGI-RY4AgiePBiJ9EODh8d9yo",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 9,
    "country_string": "es_ES",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_DyMiOwEaxLcPdBTu63Gv3hlhvLaLbW3ufvjHLeuU8U5bx3zx19t5rEKq7KMwk9f1",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 10,
    "country_string": "es_MX",
    "gigya_url": "https://accounts.us1.gigya.com",
    "gigya_api_key": "3_BFzR-2wfhMhUs5OCy3R8U8IiQcHS-81vF8bteSe8eFrboMTjEWzbf4pY1aHQ7cW0",
    "kamereon_url": "https://api-wired-prod-1-usw2.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 11,
    "country_string": "fi_FI",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_xSRCLDYhk1SwSeYQLI3DmA8t-etfAfu5un51fws125ANOBZHgh8Lcc4ReWSwaqNY",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 12,
    "country_string": "fr_FR",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_4LKbCcMMcvjDm3X89LU4z4mNKYKdl_W0oD9w-Jvih21WqgJKtFZAnb9YdUgWT9_a",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 13,
    "country_string": "fr_BE",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_ZK9x38N8pzEvdiG7ojWHeOAAej43APkeJ5Av6VbTkeoOWR4sdkRc-wyF72HzUB8X",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 14,
    "country_string": "fr_CH",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_h3LOcrKZ9mTXxMI9clb2R1VGAWPke6jMNqMw4yYLz4N7PGjYyD0hqRgIFAIHusSn",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 15,
    "country_string": "fr_LU",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_zt44Wl_wT9mnqn-BHrR19PvXj3wYRPQKLcPbGWawlatFR837KdxSZZStbBTDaqnb",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 16,
    "country_string": "hr_HR",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_HcDC5GGZ89NMP1jORLhYNNCcXt7M3thhZ85eGrcQaM2pRwrgrzcIRWEYi_36cFj9",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 17,
    "country_string": "hu_HU",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_nGDWrkSGZovhnVFv5hdIxyuuCuJGZfNmlRGp7-5kEn9yb0bfIfJqoDa2opHOd3Mu",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 18,
    "country_string": "it_IT",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_js8th3jdmCWV86fKR3SXQWvXGKbHoWFv8NAgRbH7FnIBsi_XvCpN_rtLcI07uNuq",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 19,
    "country_string": "it_CH",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_gHkmHaGACxSLKXqD_uDDx415zdTw7w8HXAFyvh0qIP0WxnHPMF2B9K_nREJVSkGq",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 20,
    "country_string": "nl_NL",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_ZIOtjqmP0zaHdEnPK7h1xPuBYgtcOyUxbsTY8Gw31Fzy7i7Ltjfm-hhPh23fpHT5",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 21,
    "country_string": "nl_BE",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_yachztWczt6i1pIMhLIH9UA6DXK6vXXuCDmcsoA4PYR0g35RvLPDbp49YribFdpC",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 22,
    "country_string": "no_NO",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_QrPkEJr69l7rHkdCVls0owC80BB4CGz5xw_b0gBSNdn3pL04wzMBkcwtbeKdl1g9",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 23,
    "country_string": "pl_PL",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_2YBjydYRd1shr6bsZdrvA9z7owvSg3W5RHDYDp6AlatXw9hqx7nVoanRn8YGsBN8",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 24,
    "country_string": "pt_PT",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3__afxovspi2-Ip1E5kNsAgc4_35lpLAKCF6bq4_xXj2I2bFPjIWxAOAQJlIkreKTD",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 25,
    "country_string": "ro_RO",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_WlBp06vVHuHZhiDLIehF8gchqbfegDJADPQ2MtEsrc8dWVuESf2JCITRo5I2CIxs",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 26,
    "country_string": "ru_RU",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_N_ecy4iDyoRtX8v5xOxewwZLKXBjRgrEIv85XxI0KJk8AAdYhJIi17LWb086tGXR",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 27,
    "country_string": "sk_SK",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_e8d4g4SE_Fo8ahyHwwP7ohLGZ79HKNN2T8NjQqoNnk6Epj6ilyYwKdHUyCw3wuxz",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 28,
    "country_string": "sl_SI",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_QKt0ADYxIhgcje4F3fj9oVidHsx3JIIk-GThhdyMMQi8AJR0QoHdA62YArVjbZCt",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}, {
    "country_id": 29,
    "country_string": "sv_SE",
    "gigya_url": "https://accounts.eu1.gigya.com",
    "gigya_api_key": "3_EN5Hcnwanu9_Dqot1v1Aky1YelT5QqG4TxveO0EgKFWZYu03WkeB9FKuKKIWUXIS",
    "kamereon_url": "https://api-wired-prod-1-euw1.wrd-aws.com",
    "kamereon_api_key": "VAX7XYKGfa92yMvXculCkEFyfZbuM7Ss"
}
];

module.exports = { RenaultApi };