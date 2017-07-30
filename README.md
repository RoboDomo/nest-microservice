# nest-microservice
MQTT  microservice for Nest Thermostat

This microservice implements the Nest Developer Streaming API and bridges with MQTT.

## Docker build instructions
You can neatly package this microservice as a Docker container:

```
$ docker build -t nest-microservice .
```

(There is a build.sh script that will do the build command for you)

## Docker run instructions

See explanation of environment variables below.

To run it:

```
$ docker run \
    -d \
    --rm \
    --name="nest-microservice" \
    -e "NEST_AUTH=big_long_nest_auth_string" \
    -e "MQTT_HOST=mqtt://hostname" \
    -e "TOPIC_ROOT=Nest" \
    nest-microservice
```

(There is a run.sh script that will do the run command for you)

To restart it:
```
$ docker restart nest-micorservice
```

## Environment Variables
1. NEST_AUTH='big long nest authorization code'

Follow the instructions here to get Nest authorization/access code (with 10 year TTL): 
http://www.digitalsanctuary.com/tech-blog/general/control-your-nest-thermostat-from-the-command-line.html

Nest API https://developers.nest.com/documentation/cloud/architecture-overview Nest credentials requires only auth_key (credentials.auth = really big string)

2. MQTT_HOST='mqtt://hostname'

This is the connection string for the client to connect to the host

3. TOPIC_ROOT='Nest'

MQTT topics will be published starting with TOPIC_ROOT, which is "Nest" by default.

For example:

_Nest_/Hallway/status/setpoint 74

## Diagnosing Docker container
There is a handy shell.sh script that will give you a bash shell in a new instantiated container.

When you exit the shell, the container is stopped/removed.

You can also use the included debug.sh script which runs the container not as a daemon, so you can see the logging output in the console.

## DNS Issues
By default, Docker looks at the host's /etc/resolv.conf file for DNS servers for the containers.

In my setup, I have dnsmasq doing DHCP and DNS, on one of my computers, for my entire LAN.  When a system gets an IP from DHCP, it also gets the IP address of my dnsmasq host.

My /etc/resolv.conf file has one line in it:
```
nameserver 127.0.0.1
```

It is tricky for Docker to set up DNS in this situation without some help.  It does not
set the containers' DNS servers to the Docker host with name server 127.0.0.1 (e.g. to the docker bridge network).
If it did, you would have to set up your dnsmasq instance to listen on the host's IP address on the docker bridge, too.

There is a perfectly fine global setup for Docker that works as we want.  Simply add a /etc/docker/daemon.json file (or edit any existing one)
with this (my DNS host is 192.168.0.17, fix the "dns" below to point at yours):

```
{
    "dns": ["192.168.0.17", "8.8.8.8"]
}
```

And restart the docker service.

NOTE: you will need to do this on any machines on your LAN that act as Docker hosts!  In my case,
I have a development machine and production machine that both host microservices and the WWW site
containers.  I had to do this procedure on both.

See: https://robinwinslow.uk/2016/06/23/fix-docker-networking-dns/

## Automatically starting container on host reboot
TBD

## Error handling
Errors the microservice encounters are published to ${topic}/exception.
