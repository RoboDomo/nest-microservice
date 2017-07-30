process.env.DEBUG = 'NestHost,HostBase'

const
    debug       = require('debug')('NestHost'),
    fs          = require('fs'),
    request     = require('superagent'),
    EventSource = require('eventsource'),
    HostBase    = require('microservice-core/HostBase')

const auth      = process.env.NEST_AUTH,
      topicRoot = process.env.TOPIC_ROOT || 'nest',
      mqttHost  = process.env.MQTT_HOST || 'mqtt://ha'

function ctof(c) {
    return Math.round(c * (9 / 5) + 32)
}

class NestHost extends HostBase {
    constructor(structure, thermostat) {
        try {
            super(mqttHost, topicRoot + '/' + structure.name + '/' + thermostat.name_long)

            console.log('new NestHost', structure.name, thermostat.name)
            this.weather = structure.postal_code
            this.auth    = auth
        }
        catch (e) {
            console.log(e)
        }
    }

    async command(setting, value) {
        debugger
        const id  = this.state.device_id,
              uri = `https://developer-api.nest.com/devices/thermostats/${id}?auth=${this.auth}`

        debug(this.device, setting, value)

        const o    = {}
        // Nest API is picky about numbers being JSON encoded as Numbers.
        o[setting] = isNaN(value) ? value : Number(value)

        return new Promise((resolve, reject) => {
            request
                .put(uri)
                .send(o)
                .end((error, result) => {
                    if (error) {
                        return reject(error.response.body)
                    }
                    else {
                        return resolve(JSON.parse(result.text))
                    }
                })
        })
    }
}

const hosts = {}

async function connect() {
    const eventSource = new EventSource('https://developer-api.nest.com?auth=' + auth)

    eventSource.addEventListener('put', async (e) => {
        const state = this.raw = JSON.parse(e.data).data,
              devices = state.devices

        Object.keys(state.structures).forEach((id) => {
            const s = state.structures[id]

            s.thermostats.forEach(async (id) => {
                const t   = devices.thermostats[id],
                      ndx = s.name + '/' + t.name_long

                hosts[ndx]       = hosts[ndx] || new NestHost(s, t)
                hosts[ndx].state = Object.assign({}, t, {
                    structure_name: s.name,
                    country_code:   s.country_code,
                    postal_code:    s.postal_code,
                    time_zone:      s.time_zone,
                    away:           s.away,
                    rhr_enrollment: s.rhr_enrollment,
                    eta_begin:      s.eta_begin,

                })
            })
        })
    })

    eventSource.addEventListener('auth_revoked', (e) => {
        debug('auth_revoked', e)
    })

    eventSource.addEventListener('open', (e) => {
        debug('eventsource opened', e)
    })

    eventSource.addEventListener('error', (e) => {
        debug('eventsource error', e)
    })
}

connect()

