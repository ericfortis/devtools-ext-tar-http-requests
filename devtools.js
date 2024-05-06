const { TarWriter } = window.tarjs

const Strings = {
  download_tar: 'Download Tar',
  filter: 'Filter',
  panel_title: 'HTTP Requests'
}

const extensionsByMime = {
  'application/javascript': 'js',
  'application/json': 'json',
  'application/zip': 'zip',
  'image/avif': 'avif',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'text/css': 'css',
  'text/html': 'html',
  'text/plain': 'txt',
  'video/mp4': 'mp4'
}

chrome.devtools.panels.create(Strings.panel_title, '', 'panel.html', panel => {
  panel.onShown.addListener(async win =>
    win.document.body.append(await App()))
})
chrome.devtools.network.onRequestFinished.addListener(registerRequest)
chrome.devtools.network.onNavigated.addListener(clearList)

let filter = ''
const files = new Map()
async function makeTar() {
  const writer = new TarWriter()
  for (const [filename, body] of files)
    if (filename.includes(filter))
      writer.addFile(filename, body)
  return await writer.write()
}

const r = createElement
const refReqList = useRef()

function registerRequest(request) {
  const { url, method } = request.request
  const { status, content } = request.response
  const path = new URL(url).pathname
  const filename = `${path}.${method}.${status}${extForMime(content.mimeType)}`
  request.getContent(body => files.set(filename, body))
  renderFilenameOnList(filename)
}

async function App() {
  const downloadLinkStyle = {
    background: 'dodgerblue',
    borderRadius: '6px',
    color: 'white',
    marginLeft: '12px',
    padding: '10px',
    textDecoration: 'none'
  }
  return (
    r('div', null,
      r('label', null, Strings.filter,
        r('input', {
          onKeyUp: function filterFileList() {
            filter = this.value
            reRenderList()
          }
        })),
      r('a', {
        style: downloadLinkStyle,
        href: '',
        download: (await urlHostname() || 'requests') + '.tar',
        onClick: async function downloadTar() {
          this.href = URL.createObjectURL(await makeTar())
        }
      }, Strings.download_tar),
      r('ul', {
        ref: refReqList
      })))
}

function renderFilenameOnList(filename) {
  if (refReqList.current && filename.includes(filter))
    refReqList.current.appendChild(r('li', null, filename))
}

function reRenderList() {
  clearList()
  for (const [filename, body] of files)
    renderFilenameOnList(filename)
}

function clearList() {
  if (refReqList.current)
    refReqList.current.innerHTML = ''
}

function urlHostname() {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval('location.href', (response, error) => {
      if (error)
        resolve('')
      else
        resolve(new URL(response).hostname)
    })
  })
}


// API similar to React.createElement
// https://github.com/uxtely/js-utils/blob/main/react-create-element/createElement.js
function createElement(elem, props, ...children) {
  const node = document.createElement(elem)
  if (props)
    for (const [key, value] of Object.entries(props))
      if (key === 'ref')
        value.current = node
      else if (key === 'style')
        Object.assign(node.style, value)
      else if (key.startsWith('on'))
        node.addEventListener(key.replace(/^on/, '').toLowerCase(), value)
      else if (key in node)
        node[key] = value
      else
        node.setAttribute(key, value)
  node.append(...children)
  return node
}

function useRef() {
  return { current: null }
}

function extForMime(mime) {
  const ext = extensionsByMime[mime]
  return ext
    ? '.' + ext
    : ''
}

