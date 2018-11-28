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
    res.sendStatus(200)
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
    const {affectedRows} = query('INSERT INTO `wemarket`.`seller` (`id`, `pw`, `storeName`, `storeDesc`, `storeType`, `sellerName`, `sellerCode`, `phone`, `bank`, `accountNumber`, `status`) VALUES ' +
      '("' + id + '", "' + hexPw + '", "' + storeName + '", "' + storeDesc + '", "' + storeType + '", "' + sellerName + '", "' + sellerCode + '", "' + phone + '", "' + bank + '", "' + accountNumber + '","JOIN")')
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
  console.log(id, pw)
  try {
    const hexPw = crypto.createHash('sha512').update(pw).digest('hex')
    const result = await query(`SELECT t.* FROM wemarket.seller t WHERE t.id = '${id}' and t.pw = '${hexPw}';`)
    if (!result[0]) {
      return res.sendStatus(404)
    }
    return res.json(result[0])
  } catch (e) {
    console.log(e)
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
      return res.sendStatus(404)
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
    if (affectedRows === 1) return res.sendStatus(200)
    else if (affectedRows === 0) return res.sendStatus(404)
  } catch (e) {
    res.status(500).json(e)
  }
})

// 판매자 정보 가져오기
app.get('/seller/:sdx', async (req, res) => {
  const {sdx} = req.params
  try {
    const result = await query(`SELECT status, storeName, storeDesc, phone FROM seller WHERE idx=${sdx}`)
    res.json(result[0])
  } catch (e) {
    res.status(500).json(e)
  }
})

async function query(sql) {
  try {
    const pool = await mysql.createPool(config)
    return new Promise(function (resolve, reject) {
      pool.query(sql, function (err, rows) {
        pool.end(function (err) {
          if (err) {
            console.log(err.message);
          }
        })
        if (err) {
          console.log(err)
          reject(new Error(err));
        } else {
          resolve(rows);
        }
      });
    });
  } catch (e) {
    console.log(e)
  }
}

// 소개 변경
app.put('/user/:idx', async (req, res) => {
  const {idx} = req.params
  const {phone, storeDesc} = req.body
  const {affectedRows} = await query(`UPDATE seller SET phone = '${phone}', storeDesc = '${storeDesc}' WHERE idx = ${idx}`)
  if (affectedRows === 1) {
    const result = await query(`SELECT * FROM seller WHERE idx = ${idx}`)
    return res.status(200).json(result[0])
  }
  else if (affectedRows === 0) return res.sendStatus(404)
})

// 파트너스(level) 상태 변경
app.put('/user/:idx/level', async (req, res) => {
  const {idx} = req.params
  const {level} = req.body // PENDING, PARTNERS 두개 값만
  const {affectedRows} = await query(`UPDATE seller SET level = '${level}' WHERE idx = ${idx}`)
  if (affectedRows === 1) {
    const result = await query(`SELECT * FROM seller WHERE idx = ${idx}`)
    return res.status(200).json(result[0])
  }
  else if (affectedRows === 0) return res.sendStatus(404)
})

// 파트너스 글 생성
app.post('/partners', async (req, res) => {
  const {title, content, endDate} = req.body
  const {affectedRows} = await query(`INSERT INTO partners (title, endDate, content, udx) VALUES ('${title}', '${endDate}', '${content}', '')`)
  try {
    if (affectedRows === 1) return res.sendStatus(200)
  } catch (e) {
    res.status(500).json(e)
  }
})

const moment = require('moment-timezone')
// 파트너스 글 목록 가져오기
app.get('/partners', async (req, res) => {
  const result = await query(`SELECT * FROM partners`)
  result.map(item => {
    item.endDate = moment.tz(item.endDate, 'Asia/Seoul').format('YYYY-MM-DD HH:mm:ss')
  })
  return res.status(200).json(result)
})

// 파트너스 판매자 참여
app.put('/partners/:pdx', async (req, res) => {
  const {sdx} = req.body // seller idx
  const {pdx} = req.params // partners idx
  const result = await query(`SELECT * FROM partners WHERE idx=${pdx}`)
  const {udx} = result[0]
  let isAlready = false
  let udxList = []
  if (udx) {
    udxList = udx.split(',')
    udxList.map(u => {
      if (u == sdx) isAlready = true
    })
    if (isAlready) return res.status(409).json({'status': '이미 신청된 글입니다.'})
  }
  udxList.push(sdx)
  const {affectedRows} = await query(`UPDATE partners SET udx='${udxList}' WHERE idx=${pdx}`)
  if (affectedRows === 1) {
    const result = await query(`SELECT * FROM partners WHERE idx = ${pdx}`)
    return res.status(200).json(result[0])
  }
  else if (affectedRows === 0) return res.sendStatus(404)
})

// 주문
app.post('/order', async (req, res) => {
  const {phone, sdx, menuText, price, type, dateCreated} = req.body
  try {
    const {affectedRows} = await query(`INSERT INTO orders (cphone, sdx, menuText, price, type, dateCreated) VALUES ('${phone}', ${sdx}, '${menuText}', ${price}, '${type}', '${dateCreated}')`)
    if (affectedRows === 1) return res.sendStatus(200)
  } catch (e) {
    res.status(500).json(e)
  }
})

// 주문내역
app.get('/orders/:sdx', async (req, res) => {
  const {sdx} = req.params
  try {
    const result = await query(`SELECT * FROM orders WHERE sdx=${sdx} ORDER BY dateCreated DESC`)
    return res.json(result)
  } catch (e) {
    res.status(500).json(e)
  }
})

// 주문상태변경
app.put('/orders/:idx', async (req, res) => {
  const {idx} = req.params
  const {status} = req.body
  try {
    const {affectedRows} = await query(`UPDATE orders SET status = '${status}' WHERE idx = ${idx}`)
    if (affectedRows === 1) return res.sendStatus(200)
  } catch (e) {
    res.status(500).json(e)
  }
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
