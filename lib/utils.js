const cheerio = require('cheerio');



function parseHtml(text) {
    const $ = cheerio.load(text)
    const data = JSON.parse($('#__APP_DATA').html())
    const content = data?.appState?.loader?.dataByRouteId?.d9b2?.articleDetail?.contentJson
    const list = content?.match(/solscan\.io\/token\/\w+/ig)?.map(item => {
        return item.split('/').pop()
    }) || []
    return list
}

function parseHtmlList(text) {
    const $ = cheerio.load(text)
    const data = JSON.parse($('#__APP_DATA').html())
    const posts = data?.appState?.loader?.dataByRouteId?.b7eb?.posts
    return posts || []
}

function parseHtmlLatest(text) {
    const $ = cheerio.load(text)
    const data = JSON.parse($('#__APP_DATA').html())
    const posts = data?.pageData?.shuviInitialState?.ssrStore?.latestArticles?.announcement
    return posts || []
}


module.exports = {
    parseHtml,
    parseHtmlList,
    parseHtmlLatest,
}
