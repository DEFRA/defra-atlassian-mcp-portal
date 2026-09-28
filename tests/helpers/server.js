/**
 * Injects a GET request into the server.
 *
 * @param {import('@hapi/hapi').Server} server
 * @param {string} url
 * @param {string} [cookie] optional Cookie header value
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function get (server, url, cookie) {
  return server.inject({
    method: 'GET',
    url,
    headers: cookie ? { Cookie: cookie } : {}
  })
}

/**
 * Injects a POST request with form-encoded payload into the server.
 *
 * @param {import('@hapi/hapi').Server} server
 * @param {string} url
 * @param {string} payload form-encoded body
 * @param {string} [cookie] optional Cookie header value
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function post (server, url, payload, cookie) {
  return server.inject({
    method: 'POST',
    url,
    headers: {
      ...cookie ? { Cookie: cookie } : {},
      'content-type': 'application/x-www-form-urlencoded'
    },
    payload
  })
}

export { get, post }
