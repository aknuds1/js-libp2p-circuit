'use strict'

const mafmt = require('mafmt')
const multiaddr = require('multiaddr')

const constants = require('./circuit/constants')
const OnionDialer = require('./circuit/onion-dialer')
const utilsFactory = require('./circuit/utils')

const debug = require('debug')
const log = debug('libp2p:circuit:transportdialer')
log.err = debug('libp2p:circuit:error:transportdialer')

const createListener = require('./listener')

class Dialer {
  /**
   * Creates an instance of Dialer.
   * @param {Swarm} swarm - the swarm
   * @param {any} options - config options
   *
   * @memberOf Dialer
   */
  constructor (swarm, options) {
    options = options || {}

    this.swarm = swarm
    this.dialer = null
    this.utils = utilsFactory(swarm)

    // get all the relay addresses for this swarm
    const relays = this.filter(swarm._peerInfo.multiaddrs.toArray())

    // if no explicit relays, add a default relay addr
    if (relays.length === 0) {
      this.swarm
        ._peerInfo
        .multiaddrs
        .add(`/p2p-circuit/ipfs/${this.swarm._peerInfo.id.toB58String()}`)
    }

    // TODO: add flag for other types of dealers, ie telescope
    this.dialer = new OnionDialer(swarm, options)

    this.swarm.on('peer-mux-established', this.dialer.dialRelay.bind(this.dialer))
    this.swarm.on('peer-mux-closed', (peerInfo) => {
      this.dialer.relayPeers.delete(peerInfo.id.toB58String())
    })

    this._dialSwarmRelays(relays)
  }

  /**
   * Dial the relays in the Addresses.Swarm config
   *
   * @param {Array} relays
   * @return {void}
   */
  _dialSwarmRelays (relays) {
    // if we have relay addresses in swarm config, then dial those relays
    this.swarm.on('listening', () => {
      relays.forEach((relay) => {
        let relaySegments = relay
          .toString()
          .split('/p2p-circuit')
          .filter(segment => segment.length)

        relaySegments.forEach((relaySegment) => {
          this.dialer.dialRelay(this.utils.peerInfoFromMa(multiaddr(relaySegment)))
        })
      })
    })
  }

  get priority () {
    return constants.PRIOIRY // TODO: move to a constants file that all transports can share
  }

  set priority (val) {
    throw new Error('Priority is read only!')
  }

  /**
   * Dial a peer over a relay
   *
   * @param {multiaddr} ma - the multiaddr of the peer to dial
   * @param {Object} options - dial options
   * @param {Function} cb - a callback called once dialed
   * @returns {Connection} - the connection
   *
   * @memberOf Dialer
   */
  dial (ma, options, cb) {
    return this.dialer.dial(ma, options, cb)
  }

  /**
   * Create a listener
   *
   * @param {any} options
   * @param {Function} handler
   * @return {listener}
   */
  createListener (options, handler) {
    if (typeof options === 'function') {
      handler = options
      options = this.options || {}
    }

    return createListener(this.swarm, options, handler)
  }

  /**
   * Filter check for all multiaddresses
   * that this transport can dial on
   *
   * @param {any} multiaddrs
   * @returns {Array<multiaddr>}
   *
   * @memberOf Dialer
   */
  filter (multiaddrs) {
    if (!Array.isArray(multiaddrs)) {
      multiaddrs = [multiaddrs]
    }
    return multiaddrs.filter((ma) => {
      return mafmt.Circuit.matches(ma)
    })
  }
}

module.exports = Dialer
