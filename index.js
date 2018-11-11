'use strict'
const express = require('express')
const app = express()
const port = 3000
const mysql = require('mysql')
const config = require('./config')
const bodyParser = require('body-parser')
const crypto = require('crypto')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())
app.use(function (req, res, next) {
  var oneof = false
  if (req.headers.origin) {
    res.header('Access-Control-Allow-Origin', req.headers.origin)
    oneof = true
  }
  if (req.headers['access-control-request-method']) {
    res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method'])
    oneof = true
  }
  if (req.headers['access-control-request-headers']) {
    res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
    oneof = true
  }
  if (oneof) {
    res.header('Access-Control-Max-Age', 60 * 60 * 24 * 365)
  }
  if (oneof && req.method === 'OPTIONS') {
    res.send(200)
  } else {
    next()
  }
})
app.post('/join', async (req, res) => {
  const connection = await mysql.connect(config)
  const {
    id,
    pw,
    storeName,
    storeDesc,
    storeType,
    sellerName,
    sellerCode,
    phone,
    bank,
    accountNumber
  } = req.body
  const hexPw = crypto.createHash('sha512').update(pw).digest('hex')
  try {
    const {affectedRows} = await connection.query('INSERT INTO `wemarket`.`seller` (`id`, `pw`, `storeName`, `storeDesc`, `storeType`, `sellerName`, `sellerCode`, `phone`, `bank`, `accountNumber`) VALUES ' +
      '("' + id + '", "' + hexPw + '", "' + storeName + '", "' + storeDesc + '", "' + storeType + '", "' + sellerName + '", "' + sellerCode + '", "' + phone + '", "' + bank + '", "' + accountNumber + '")')
    res.json({affectedRows})
  } catch (e) {
    if (e.message.split(':')[1].trim() === 'ER_DUP_ENTRY') {
      res.status(409).json({})
    } else {
      res.status(500).json(e)
    }
  }
})
app.post('/login', async (req, res) => {
  const connection = await mysql.connect(config)
  const {
    id,
    pw
  } = req.body
  const hexPw = crypto.createHash('sha512').update(pw).digest('hex')
  try {
    const result = await connection.query(`SELECT t.* FROM wemarket.seller t WHERE t.id = '${id}' and t.pw = '${hexPw}';`)
    if (!result[0]) {
      return res.status(404).send()
    }
    return res.json(result[0])
  } catch (e) {
    res.status(500).json(e)
  }
})
// 메뉴 생성
app.post('/menu/:sdx', async (req, res) => {
  const connection = await mysql.connect(config)
  const {
    name,
    image,
    price
  } = req.body
  const {
    sdx
  } = req.param
  try {
    const {affectedRows} = await connection.query(`INSERT INTO menu (sdx, image, name, price) VALUES (${sdx}, '${name}', '${image}', ${price})`)
    if (affectedRows === 1) return res.status(200).send()
  } catch (e) {
    res.status(500).json(e)
  }
})
// 메뉴 리스트
app.get('/menu/:sdx', async (req, res) => {
  const {
    sdx
  } = req.params
  try {
    const result = await query(`SELECT * FROM menu WHERE sdx = ${sdx}`)
    if (!result[0]) {
      return res.status(404).send()
    }
    return res.json(result)
  } catch (e) {
    console.log(e)
    res.status(500).json(e)
  }
})

async function query(sql) {
  const pool = await mysql.createPool(config)
    return new Promise(function (resolve, reject) {
      pool.query(sql, function (err, rows) {
        if (err) {
          reject(new Error(err));
        } else {
          resolve(rows);
        }
      });
    });
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
