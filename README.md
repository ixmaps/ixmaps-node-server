
# Interfaces

## JSON
* [traces](/api/traces)
* [state](/api/state)

## HTML

* [index](/)
* [Dagre graph](/dagre.html)
* [Network](/network.html) (FIXME)
* [Ringmap](/ringmap.html) (FIXME

## Server

### Installation

* Clone from git
* install Node
* npm install
* node index.js

## VM

* Set up with paris-traceroute, node, server instance

## Node-Webkit

* option to VM

## Native messaging



# Activities

* check into git with README
* set up Debian VM with new paris-traceroute (requires root)
 * try NAT
* node raw sockets traceroute
* expose p-t options
 * mda
 * possibility to implement paris traceroutes in js
* new visualization

* mark * hosts behind routers
* augment data
 * add hostname, ASN, location, etc
* add REFERER (associations)
* Data in reusable format
<pre>
				hop: {
					origin: octet,
					ixlogin: object,
					ix_lat: number,
					ix_long: number,
					destination: octet,
					source: octet
					next: octet,
					asNum: int,
					asName: string,
					lat: "49.25",
					long: "-123.133",
					mm_city: "Vancouver",
					mm_country: "CA",
					rtt_ms: "14",
					gl_override: null,
					dist_from_origin: 2429.59704536,
					imp_dist: 1,
					time_light: 24.2959704536,
					latOrigin: "38",
					longOrigin: "-97",
					flagged: "0"
					locationSource: string,
					hostname
				}
</pre>
* Decide on best path between native messaging, sidekick app or VM
* Discuss next steps for overall system
 * data augmentation
 * data model
 * server components
 * messaging
