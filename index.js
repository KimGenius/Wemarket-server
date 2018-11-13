'use strict'
const express = require('express')
const app = express()
const port = 3000
const mysql = require('mysql')
const config = require('./config')
const bodyParser = require('body-parser')
const crypto = require('crypto')
// parse application/x-www-form-urlencoded
app.use('/uploads', express.static('uploads'))
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}))

// parse application/json
app.use(bodyParser.json({limit: '100mb'}))
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
    const {affectedRows} = query('INSERT INTO `wemarket`.`seller` (`id`, `pw`, `storeName`, `storeDesc`, `storeType`, `sellerName`, `sellerCode`, `phone`, `bank`, `accountNumber`) VALUES ' +
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
  const {
    id,
    pw
  } = req.body
  const hexPw = crypto.createHash('sha512').update(pw).digest('hex')
  try {
    const result = await query(`SELECT t.* FROM wemarket.seller t WHERE t.id = '${id}' and t.pw = '${hexPw}';`)
    if (!result[0]) {
      return res.status(404).send()
    }
    return res.json(result[0])
  } catch (e) {
    res.status(500).json(e)
  }
})
const multer = require('multer')
var storage = multer.diskStorage(
  {
    destination: './uploads/',
    filename: function (req, file, cb) {
      const fileName = file.originalname.split('.')
      const fileExt = fileName[fileName.length - 1]
      cb(null, req.params.sdx + ':' + req.params.idx + '.' + fileExt);
    }
  }
);
var upload = multer({storage: storage})
// 메뉴 생성
app.post('/menu/:sdx/image/:idx', upload.single('image'), async (req, res) => {
  const {idx} = req.params
  const filename = req.file.filename ? req.file.filename : ''
  await query(`UPDATE menu SET image = '${filename}' WHERE idx = ${idx}`)
  res.status(200).json(req.file)
})
app.post('/menu/:sdx', async (req, res) => {
  const {
    name,
    price
  } = req.body
  const {
    sdx
  } = req.params
  try {
    const {affectedRows} = await query(`INSERT INTO menu (sdx, image, name, price) VALUES (${sdx}, '', '${name}', ${price})`)
    if (affectedRows === 1) {
      const result = await query(`SELECT idx FROM menu WHERE sdx=${sdx} ORDER BY idx DESC limit 1`)
      return res.status(200).json({idx: result[0].idx})
    }
  } catch (e) {
    console.log(e)
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
// 메뉴 삭제
app.delete('/menu/:idx', async (req, res) => {
  const {
    idx
  } = req.params
  try {
    const {affectedRows} = await query(`DELETE FROM menu WHERE idx = ${idx}`)
    if (affectedRows === 1) return res.status(200).send()
    else if (affectedRows === 0) return res.status(404).send()
  } catch (e) {
    res.status(500).json(e)
  }
})

async function query(sql) {
  const pool = await mysql.createPool(config)
  return new Promise(function (resolve, reject) {
    pool.query(sql, function (err, rows) {
      pool.end(function(err) {
        if(err) {
          console.log(err.message);
        }
      })
      if (err) {
        reject(new Error(err));
      } else {
        resolve(rows);
      }
    });
  });
}

// 소개 변경
app.put('/user/:idx', async (req, res) => {
  const {idx} = req.params
  const {phone, storeDesc} = req.body
  const {affectedRows} = await query(`UPDATE seller SET phone = '${phone}', storeDesc = '${storeDesc}' WHERE idx = ${idx}`)
  if (affectedRows === 1) {
    const result = await query(`SELECT * FROM seller WHERE idx = ${idx}`)
    return res.status(200).send(result[0])
  }
  else if (affectedRows === 0) return res.status(404).send()
})

// 파트너스(level) 상태 변경
app.put('/user/:idx/level', async (req, res) => {
  const {idx} = req.params
  const {level} = req.body // PENDING, PARTNERS 두개 값만
  const {affectedRows} = await query(`UPDATE seller SET level = '${level}' WHERE idx = ${idx}`)
  if (affectedRows === 1) {
    const result = await query(`SELECT * FROM seller WHERE idx = ${idx}`)
    return res.status(200).send(result[0])
  }
  else if (affectedRows === 0) return res.status(404).send()
})
app.listen(port, () => console.log(`Example app listening on port ${port}!`))
