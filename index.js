const fetch = require('node-fetch')
const uuid = require('uuid').v4
const ADMZIP = require('adm-zip');

// ---------------------------------------------------------- DATA

// ---- USED AGENT
const user_agent = 'remarkable-cloud-js'

// ---- AUTH
const auth_host = 'https://my.remarkable.com'
const auth_device_ep = '/token/json/2/device/new'
const auth_user_ep = '/token/json/2/user/new'

// ---- DISCOVERY
const discovery_host = 'https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1'
const storage_discovery_ep = '/document-storage?environment=production&group=auth0%7C5a68dc51cb30df1234567890&apiVer=2'
const notifications_discovery_ep = '/notifications?environment=production&group=auth0%7C5a68dc51cb30df1234567890&apiVer=1'

// ---- STORAGE
const docs_ep = '/document-storage/json/2/docs'
const upload_request_ep = '/document-storage/json/2/upload/request'
const update_status_ep = '/document-storage/json/2/upload/update-status'
const delete_ep = '/document-storage/json/2/delete'

// ---------------------------------------------------------- UTILS

async function rm_api({ url, method = 'GET', headers = {}, prop = null, body = null, expected = 'json' }) {
    let options = { method, headers }
    headers['User-Agent'] = user_agent
    if (body) options.body = JSON.stringify(body)
    let resp = await fetch(url, options)
    if (![200, 201, 202, 203, 204].includes(resp.status)) throw resp
    let parsed_resp = await resp[expected]()
    if (prop) return parsed_resp[prop]
    return parsed_resp
}

// ---------------------------------------------------------- MAIN CLASS
class REMARKABLEAPI {

    // ---------------------------------- CONSTRUCT

    constructor(device_token = null) {
        this.device_token = device_token
        this.user_token = null

        this.storage_host = null
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
        return this.device_token
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
        return this.user_token
    }

    // ---------------------------------- AUTHED API CALL

    async api({ url, method = 'GET', headers = {}, prop = null, body = null, expected = 'json' }) {
        if (!this.user_token) throw 'api must be authenticated first using "refresh_token"'
        headers.Authorization = `Bearer ${this.user_token}`
        let resp = await rm_api({ url, method, headers, prop, body, expected })
        return resp
    }

    async get_storage_host() {
        if (!this.storage_host) this.storage_host = 'https://' + await rm_api({ url: discovery_host + storage_discovery_ep, prop: 'Host' })
        return this.storage_host
    }

    // ---------------------------------- API METHOD OVERRIDE

    async raw_docs() {
        return await this.api({ url: (await this.get_storage_host()) + docs_ep })
    }

    // async upload_request() {

    // }

    // async update_status() {

    // }

    // async delete() {

    // }

    // ---------------------------------- UTILS

    async docs_paths() {
        let docs = await this.raw_docs()
        let id_map = Object.fromEntries(docs.map(obj => [obj.ID, obj]))
        function get_childrens(id) {
            return docs.filter(({ Parent }) => Parent == id)
        }
        function create_paths(id, past_path = '') {
            id_map[id]._path = past_path + '/' + id_map[id].VissibleName
            get_childrens(id).forEach(({ ID }) => create_paths(ID, id_map[id]._path))
        }
        docs.filter(({ Parent }) => Parent == '').forEach(({ ID }) => create_paths(ID, ''))
        return docs
    }

    async corrupted_docs() {
        return (await this.docs_paths()).filter(({ Parent, _path }) => Parent != 'trash' && _path === undefined)
    }

    async get_path(path) {
        return (await this.docs_paths()).filter(({ _path }) => _path == path)[0]
    }

    // ---------------------------------- DATA RETREIAVAL

    async exists(path) {
        return (await this.get_path(path)) != undefined
    }

    // async unlink(path) {
    //     let doc = await get_path(path)
    //     if (!doc) throw REMARKABLEAPI.exception.path_not_found(path)
    //     return await this.update_status(doc, { Parent: 'trash' })
    // }

    // async mkdir(path) {
    // }

    // async write_pdf(path, pdf_path) {
    // }

    // async write_epub(path, epub_path) {
    // }

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

REMARKABLEAPI.exception = {
    path_not_found: (path) => `path "${path}" not found.`
}

const all_device_desc = Object.values(REMARKABLEAPI.device_desc).map(sub => Object.values(sub)).flat()

module.exports = REMARKABLEAPI