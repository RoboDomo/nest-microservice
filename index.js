process.env.DEBUG = "ThermostatHost,HostBase";
process.title = process.env.TITLE || "nest-microservice";

const debug = require("debug")("ThermostatHost"),
  console = require("console"),
  request = require("superagent"),
  EventSource = require("eventsource"),
  HostBase = require("microservice-core/HostBase");

const auth = process.env.NEST_AUTH,
  topicRoot = process.env.TOPIC_ROOT || "nest",
  mqttHost = process.env.MQTT_HOST || "mqtt://robodomo";

/**
 * Thermostat
 */
class ThermostatHost extends HostBase {
  constructor(structure, thermostat) {
    super(
      mqttHost,
      topicRoot + "/" + structure.name + "/" + thermostat.name_long
    );
    this.dying = false;
    try {
      console.log("new ThermostatHost", structure.name, thermostat.name);
      this.structure = structure;
      this.thermostat = thermostat;
      this.weather = structure.postal_code;
      this.auth = auth;
    } catch (e) {
      console.log(e);
    }
  }

  async command(setting, value) {
    const id = this.state.device_id,
      uri = `https://developer-api.nest.com/devices/thermostats/${id}?auth=${
        this.auth
      }`;

    debug(`${this.thermostat.name}, setting "${setting}" => "${value}"`);

    const o = {};
    // Nest API is picky about numbers being JSON encoded as Numbers.
    o[setting] = isNaN(value) ? value : Number(value);

    return new Promise((resolve, reject) => {
      request
        .put(uri)
        .send(o)
        .end((error, result) => {
          if (error) {
            console.log("error", error);
            return reject(error.response.body);
          } else {
            return resolve(JSON.parse(result.text));
          }
        });
    });
  }
}

class ProtectHost extends HostBase {
  constructor(structure, protect) {
    super(mqttHost, topicRoot + "/" + structure.name + "/" + protect.name_long);
  }
  async command() {}
}

const hosts = {};

async function connect() {
  const eventSource = new EventSource(
    "https://developer-api.nest.com?auth=" + auth,
    { headers: { Authorizaton: "Bearer " + auth } }
  );

  eventSource.addEventListener("put", async e => {
    //    console.log("GOT EVENT", e);
    const state = (this.raw = JSON.parse(e.data).data),
      devices = state.devices;

    Object.keys(state.structures).forEach(id => {
      const s = state.structures[id];

      s.thermostats.forEach(async id => {
        const t = devices.thermostats[id],
          ndx = s.name + "/" + t.name_long;

        hosts[ndx] = hosts[ndx] || new ThermostatHost(s, t);
        hosts[ndx].state = Object.assign({}, t, {
          structure_name: s.name,
          country_code: s.country_code,
          postal_code: s.postal_code,
          time_zone: s.time_zone,
          away: s.away,
          rhr_enrollment: s.rhr_enrollment,
          eta_begin: s.eta_begin
        });
      });
      s.smoke_co_alarms.forEach(async id => {
        const t = devices.smoke_co_alarms[id],
          ndx = s.name + "/" + t.name_long;

        hosts[ndx] = hosts[ndx] || new ProtectHost(s, t);
        hosts[ndx].state = Object.assign({}, t, {
          structure_name: s.name,
          country_code: s.country_code,
          postal_code: s.postal_code,
          time_zone: s.time_zone,
          away: s.away,
          rhr_enrollment: s.rhr_enrollment,
          eta_begin: s.eta_begin
        });
      });
    });
  });

  eventSource.addEventListener("auth_revoked", e => {
    debug("auth_revoked", e);
  });

  eventSource.addEventListener("open", e => {
    debug("eventsource opened", e);
  });

  eventSource.addEventListener("error", e => {
    debug("eventsource error", e);
    if (!this.dying) {
      this.dying = true;
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }
  });
}

connect();
