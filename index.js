const fetch = require('node-fetch')
const uuid = require('uuid').v4

// ---------------------------------------------------------- DATA

// ---- USED AGENT
const user_agent = 'remarkable-cloud-js'

// ---- AUTH
const auth_host = 'https://my.remarkable.com'
const auth_device_ep = '/token/json/2/device/new'
const auth_user_ep = '/token/json/2/user/new'

// ---------------------------------------------------------- UTILS

async function rm_api({ url, method = 'GET', headers = {}, prop = null, body = null, expected = 'json' }) {
    let options = { method, headers }
    headers['User-Agent'] = user_agent
    if (body) options.body = JSON.stringify(body)
    let resp = await fetch(url, options)
    if (![200, 201, 202, 203, 204].includes(resp.status)) throw resp
    let parsed_resp = await resp[expected]()
    if (prop) return json_resp[prop]
    return parsed_resp
}

// ---------------------------------------------------------- MAIN CLASS
class REMARKABLEAPI {

    // ---------------------------------- CONSTRUCT

    constructor(device_token = null) {
        this.device_token = device_token
        this.user_token = null
    }

    // ---------------------------------- AUTHENTICATION

    async register_device(one_time_code, device_desc = REMARKABLEAPI.device_desc.desktop.linux, device_id = uuid()) {
        if (!all_device_desc.includes(device_desc))
            throw `device description must be of types ${all_device_desc.join(', ')}`
        this.device_token = await rm_api({
            url: auth_host + auth_device_ep,
            method: 'POST',
            body: {
                code: one_time_code,
                deviceDesc: device_desc,
                deviceID: device_id
            },
            expected: 'text'
        })
    }

    async refresh_token() {
        if (!this.device_token) throw 'api must be registered first using "register_device"'
        this.user_token = await rm_api({
            url: auth_host + auth_user_ep,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.device_token}`
            },
            expected: 'text'
        })
    }

}

// ---------------------------------------------------------- DEVICE DESC
REMARKABLEAPI.device_desc = {
    desktop: {
        windows: 'desktop-windows',
        macos: 'desktop-macos',
        linux: 'desktop-linux'
    },
    mobile: {
        android: 'mobile-android',
        ios: 'mobile-ios',
    },
    browser: {
        chrome: 'browser-chrome'
    }
}

const all_device_desc = Object.values(REMARKABLEAPI.device_desc).map(sub => Object.values(sub)).flat()

module.exports = REMARKABLEAPI