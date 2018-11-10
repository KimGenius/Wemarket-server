'use strict'
// async/await can be used only within an async function.
;(async () => {
  try {
    console.log('connect mysql', config)
  } catch (err) {
    console.error(err)
  }
})()
module.exports = mysql
