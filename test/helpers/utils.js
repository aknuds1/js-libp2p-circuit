'use strict'

const TestNode = require('./test-node')
const PeerInfo = require('@arve.knudsen/peer-info')
const PeerId = require('@arve.knudsen/peer-id')
const eachAsync = require('async/each')

exports.createNodes = function createNodes (configNodes, callback) {
  const nodes = {}
  eachAsync(Object.keys(configNodes), (key, cb1) => {
    let config = configNodes[key]

    const setup = (err, peer) => {
      if (err) {
        callback(err)
      }

      eachAsync(config.addrs, (addr, cb2) => {
        peer.multiaddrs.add(addr)
        cb2()
      }, (err) => {
        if (err) {
          return callback(err)
        }

        nodes[key] = new TestNode(peer, config.transports, config.muxer, config.config)
        cb1()
      })
    }

    if (config.id) {
      PeerId.createFromJSON(config.id, (err, peerId) => {
        if (err) return callback(err)
        PeerInfo.create(peerId, setup)
      })
    } else {
      PeerInfo.create(setup)
    }
  }, (err) => {
    if (err) {
      return callback(err)
    }

    startNodes(nodes, (err) => {
      if (err) {
        callback(err)
      }

      callback(null, nodes)
    })
  })
}

function startNodes (nodes, callback) {
  eachAsync(Object.keys(nodes),
    (key, cb) => {
      nodes[key].start(cb)
    },
    (err) => {
      if (err) {
        return callback(err)
      }
      callback(null)
    })
}

exports.stopNodes = function stopNodes (nodes, callback) {
  eachAsync(Object.keys(nodes),
    (key, cb) => {
      nodes[key].stop(cb)
    },
    (err) => {
      if (err) {
        return callback(err)
      }
      callback()
    })
}
