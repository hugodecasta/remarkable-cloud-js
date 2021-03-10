const fetch = require('node-fetch')
const uuid = require('uuid').v4
const ADMZIP = require('adm-zip');
const fs = require('fs')

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

async function rm_api({ url, method = 'GET', headers = {}, prop = null, body = null, raw_body = null, expected = 'json' }) {
    let options = { method, headers }
    headers['User-Agent'] = user_agent
    if (body || raw_body) options.body = raw_body ? raw_body : JSON.stringify(body)
    let resp = await fetch(url, options)
    if (![200, 201, 202, 203, 204].includes(resp.status)) throw resp
    if (!expected) return resp
    let parsed_resp = await resp[expected]()
    if (prop != null) return parsed_resp[prop]
    return parsed_resp
}

function create_zip_buffer(zip_map, ID) {
    let final_zip_map = Object.fromEntries(Object.entries(zip_map)
        .map(([file_path, content]) => [
            file_path.replace('{ID}', ID),
            Buffer.isBuffer(content) ?
                content :
                typeof content == 'object' ?
                    Buffer.from(JSON.stringify(content)) :
                    Buffer.from(content)
        ])
    )
    let zip = new ADMZIP()
    Object.entries(final_zip_map).forEach(([file_path, content_buffer]) => zip.addFile(file_path, content_buffer))
    return zip.toBuffer()
}

function raw_path_elements(full_path) {
    if (!full_path) return full_path
    let path_elements = full_path.split('/')
    let name = path_elements.pop()
    let parent_path = path_elements.join('/')
    return { name, parent_path }
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

    async api({ url, method = 'GET', headers = {}, prop = null, body = null, raw_body = null, expected = 'json' }) {
        if (!this.user_token) throw 'api must be authenticated first using "refresh_token"'
        headers.Authorization = `Bearer ${this.user_token}`
        let resp = await rm_api({ url, method, headers, prop, body, raw_body, expected })
        return resp
    }

    async get_storage_host() {
        if (!this.storage_host) this.storage_host = 'https://' + await rm_api({ url: discovery_host + storage_discovery_ep, prop: 'Host' })
        return this.storage_host
    }

    async storage_url_maker(endpoint) {
        return (await this.get_storage_host()) + endpoint
    }

    // ---------------------------------- API METHOD OVERRIDE

    async raw_docs() {
        return await this.api({ url: await this.storage_url_maker(docs_ep) })
    }

    async get_doc(ID, with_blob = true) {
        return await this.api({
            url: `${await this.storage_url_maker(docs_ep)}?doc=${ID}&withBlob=${JSON.stringify(with_blob)}`,
            prop: 0
        })
    }

    async upload_request(doc = null) {
        let ID = doc?.ID ?? uuid()
        let modification_date = new Date().toISOString()
        let sending_document = {
            ID,
            Version: (doc?.Version ?? 0) + 1,
            lastModified: modification_date,
            ModifiedClient: modification_date,
        }
        let resp = await this.api({
            url: await this.storage_url_maker(upload_request_ep),
            method: 'PUT',
            prop: 0,
            body: [sending_document]
        })
        if (!resp.Success) throw REMARKABLEAPI.exception.upload_request_error(resp.Message)
        return resp
    }

    async update_status(doc, changed_doc_data) {
        let modification_date = new Date().toISOString()
        delete doc._path
        let sending_document = {
            ...doc,
            Version: doc.Version + 1,
            lastModified: modification_date,
            ModifiedClient: modification_date,
            ...changed_doc_data,
        }
        let resp = await this.api({
            url: await this.storage_url_maker(update_status_ep),
            method: 'PUT',
            prop: 0,
            body: [sending_document]
        })
        if (!resp.Success) throw REMARKABLEAPI.exception.update_error(resp.Message)
        return sending_document
    }

    async delete(doc) {
        let resp = await this.api({
            url: await this.storage_url_maker(delete_ep),
            method: 'PUT',
            prop: 0,
            body: [doc]
        })
        if (!resp.Success) throw REMARKABLEAPI.exception.delete_error(resp.Message)
        return resp.Success
    }

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

    async trashed_docs() {
        return (await this.docs_paths()).filter(({ Parent }) => Parent == 'trash')
    }

    async get_path(path) {
        if (path == '') {
            return { ID: '' }
        } else if (path == 'trash') {
            return { ID: 'trash' }
        } else if (path == '/') {
            return { ID: '' }
        }
        return (await this.docs_paths()).filter(({ _path }) => _path == path)[0]
    }

    async get_final_path(path) {
        let doc = await this.get_path(path)
        if (!doc) throw REMARKABLEAPI.exception.path_not_found(path)
        return doc
    }

    async get_path_content(path) {
        return (await this.docs_paths()).filter(({ _path }) => raw_path_elements(_path)?.parent_path == path)
    }

    async fix_corrupted_docs(move_to_path = 'trash') {
        let new_parent = await this.get_path(move_to_path)
        if (!new_parent) throw REMARKABLEAPI.exception.path_not_found(move_to_path)
        let corrupted_docs = await this.corrupted_docs()
        for (let doc of corrupted_docs) {
            await this.update_status(doc, { Parent: new_parent.ID })
        }
        return corrupted_docs
    }

    async get_ID(id) {
        return (await this.docs_paths()).filter(({ ID }) => ID == id)[0]
    }

    async get_name(name) {
        return (await this.docs_paths()).filter(({ VissibleName }) => VissibleName == name)
    }

    async path_elements(full_path, check_exists = true) {
        let path_elements = full_path.split('/')
        let name = path_elements.pop()
        let parent_path = path_elements.join('/')
        if (check_exists) await this.get_final_path(parent_path)
        return { name, parent_path }
    }

    async upload_zip_data(name, parent_path, type, zip_map, doc = null) {
        let parent = await this.get_path(parent_path)
        if (!parent) throw REMARKABLEAPI.exception.path_not_found(parent_path)
        let { ID, BlobURLPut } = await this.upload_request(doc)
        let zip_buffer = create_zip_buffer(zip_map, ID)
        await this.api({
            url: BlobURLPut,
            method: 'PUT',
            raw_body: zip_buffer,
            expected: null
        })
        let base_document = {
            Parent: parent.ID,
            Bookmarked: doc?.Bookmarked,
            Type: type,
            VissibleName: name,
        }
        return await this.update_status({ ID, Version: doc?.Version ?? 0 }, base_document)
    }

    // ---------------------------------- DATA RETREIAVAL

    async exists(path) {
        return (await this.get_path(path)) != undefined
    }

    async unlink(path) {
        let doc = await this.get_final_path(path)
        return await this.delete(doc)
    }

    async move(path, new_parent_path) {
        let doc = await this.get_final_path(path)
        let new_parent_doc = await this.get_path(new_parent_path)
        if (!new_parent_doc) throw REMARKABLEAPI.exception.path_not_found(new_parent_path)
        return await this.update_status(doc, { Parent: new_parent_doc.ID })
    }

    async rename(path, new_name) {
        let doc = await this.get_final_path(path)
        return await this.update_status(doc, { VissibleName: new_name })
    }

    async read_zip(path) {
        let doc = await this.get_final_path(path)
        let { BlobURLGet } = await this.get_doc(doc.ID)
        let buffer = await rm_api({
            url: BlobURLGet,
            expected: 'buffer'
        })
        let zip = new ADMZIP(buffer)
        return Object.fromEntries(zip.getEntries().map(data => {
            let raw_data = data.getData()
            let parsed_data = raw_data
            try {
                parsed_data = JSON.parse(raw_data)
            } catch (e) {
                parsed_data = raw_data
            }
            let name = data.entryName.replace(doc.ID, '{ID}')
            return [name, parsed_data]
        }))
    }

    async write_zip(path, zip_map, type) {
        let doc = await this.get_path(path)
        let { name, parent_path } = await this.path_elements(path)
        return await this.upload_zip_data(
            name, parent_path,
            type,
            zip_map,
            doc
        )
    }

    async mkdir(path) {
        return write_zip(path, { "{ID}.content": {} }, REMARKABLEAPI.type.collection)
    }

    async copy(from_path, to_path, recursive = true) {
        if (await this.get_path(to_path)) throw REMARKABLEAPI.exception.path_already_exists_error(to_path)
        let doc = await this.get_final_path(from_path)
        let zip_map = await this.read_zip(from_path)
        let new_doc = await this.write_zip(to_path, zip_map, doc.Type)
        if (recursive && doc.Type == REMARKABLEAPI.type.collection) {
            let sub_docs = await this.get_path_content(from_path)
            for (let sub_doc of sub_docs)
                await this.copy(sub_doc._path, to_path + '/' + sub_doc.VissibleName)

        }
        return new_doc
    }

    async write_pdf(path, pdf_path) {
        return await this.write_zip(path, {
            '{ID}.content': {
                extraMetadata: {},
                fileType: 'pdf',
                lastOpenedPage: 0,
                lineHeight: -1,
                margins: 180,
                pageCount: 0,
                textScale: 1,
                transform: {},
            },
            '{ID}.pagedata': [],
            '{ID}.pdf': fs.readFileSync(pdf_path)
        }, REMARKABLEAPI.type.document)
    }

    async read_pdf(path) {
        return (await this.read_zip(path))['{ID}.pdf']
    }

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

REMARKABLEAPI.type = {
    document: 'DocumentType',
    collection: 'CollectionType'
}

REMARKABLEAPI.exception = {
    path_not_found: (path) => `path "${path}" not found.`,
    update_error: (error) => `error while updating: "${error}".`,
    upload_request_error: (error) => `error while requesting for upload: "${error}".`,
    delete_error: (error) => `error while deleting: "${error}".`,
    path_already_exists_error: (error) => `path "${error}" already exists.`
}

const all_device_desc = Object.values(REMARKABLEAPI.device_desc).map(sub => Object.values(sub)).flat()

module.exports = REMARKABLEAPI