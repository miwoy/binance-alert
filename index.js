
// 把上面注释转换成 js 代码
const axios = require('axios');
const fs = require('fs');
const { parseHtml, parseHtmlList, parseHtmlLatest } = require("./lib/utils")
const { HttpsProxyAgent } = require('https-proxy-agent');
const dotenv = require("dotenv")
dotenv.config()
const PROXY = process.env.PROXY;
const PUSH_URL = process.env.PUSH_URL
const PUSH_APP_SERCRET = process.env.PUSH_APP_SERCRET

const pageSize = 2
const api_url = `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=${pageSize}`;
const detail_base_url = "https://www.binance.com/en/support/announcement/";
const filepath = './.articles.json';
const tick = 8 * 1000

async function pushMessage(article) {
    if (PUSH_URL === 'null') return;
    function formatStr(str) {
        return str.toString().replace(/([|{\[\]*_~}+)(#>!=\-.])/gm, '\\$1')
    }
    const data = {
        appSercret: PUSH_APP_SERCRET,
        message: `*【Binance list new coin】*\n\n*Titile*: ${formatStr(article.title)}\n\n*\`${article.mints.map(m => formatStr(m)).join('`\n\n`')}\`*\n\n_From Binance Monitor_\\.`,
        inlineKeybords: [[{
            text: '买入',
            url: 'https://t.me/panghu_sol_bot'
        }]]
    };
    try {
        const res = await axios.post(PUSH_URL, data);
        console.info(res.data);
    } catch (e) {
        console.error(e);
    }
}

function initCache() {

    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, '{}')
    }

    return require(filepath)
}

function saveCache(data) {
    fs.writeFileSync(filepath, JSON.stringify(data))
}

async function sleep(tick) {
    await new Promise(resolve => setTimeout(resolve, tick));
}

async function main() {
    const articles = initCache()
    log_with_time("Initialization complete. Monitoring new articles...");

    let list = await getList()

    // 首次获取缓存
    // list.forEach(item => {
    //     articles[item.code] = item
    // })
    saveCache(articles)

    while (true) {
        try {
            await Promise.all([
                (async () => {
                    list = await getList()
                    await Promise.all(list.map(async item => {
                        if (!articles[item.code]) {
                            log_with_time(`新公告API:`, item.code, item.title, new Date(item.releaseDate))
                            if (/^Binance Will List/.test(item.title)) {
                                // 发现新的上币计划
                                log_with_time(`发现新的上币公告`, item.code, item.title)

                                const res = await getDetail(item);
                                if (res.length > 0) {
                                    pushMessage({
                                        title: item.title,
                                        code: item.code,
                                        releaseDate: new Date(item.releaseDate),
                                        mints: res
                                    }).catch(console.error)
                                    log_with_time(`发现新的上币计划`, res)
                                }

                            }
                        }
                        articles[item.code] = item
                    }))

                })(),
                (async () => {

                    let posts = await getTimeline()
                    posts = posts.slice(0, pageSize)
                    await Promise.all(posts.map(async item => {
                        if (!articles[item.id]) {
                            log_with_time(`新公告POST:`, item.id, item.title, new Date(item.firstReleaseTime))
                            // if (/^Binance Will List/.test(item.title)) {
                            //     // 发现新的上币计划
                            //     log_with_time(`发现新的上币公告`, item.code, item.title)
                            //     const res = await getDetail(item);
                            //     return log_with_time(`发现新的上币计划`, res)
                            // }
                            articles[item.id] = {
                                id: item.id,
                                title: item.title,
                                content: item.bodyTextOnly,
                                releaseDate: item.firstReleaseTime,
                                createTime: item.createTime
                            }
                        }
                    }))

                })(),
                (async () => {
                    list = await getAnnouncement()
                    await Promise.all(list.map(async item => {
                        if (!articles[item.id]) {
                            log_with_time(`新公告Announcement:`, item.id, item.title, new Date(item.publishDate))
                            articles[item.id] = item
                        }

                    }))
                })(),
            ])


        } catch (err) {
            console.error(err)
            log_with_time(`Error during monitoring: ${err.message}`)
        } finally {
            saveCache(articles)
            await sleep(tick)
        }

    }
}

async function getList() {
    try {
        const response = await axios.get(api_url, {
            httpsAgent: PROXY ? new HttpsProxyAgent(PROXY) : undefined
        });
        const data = response.data;

        if (data["code"] === "000000" && data["data"]) {
            const articles = data["data"]["catalogs"][0]["articles"];
            return articles;
        } else {
            log_with_time(`Error fetching list: ${data.message}`);
        }
    } catch (e) {
        log_with_time(`Error fetching list: ${e}`);
    }
}

async function getTimeline() {
    let api_url = "https://www.binance.com/en/square/profile/binance_announcement"
    const res = await axios.get(api_url, {
        httpsAgent: PROXY ? new HttpsProxyAgent(PROXY) : undefined
    });
    return parseHtmlList(res.data)
}

async function getAnnouncement() {
    const api_url = "https://www.binance.com/en/support/announcement";
    const res = await axios.get(api_url, {
        httpsAgent: PROXY ? new HttpsProxyAgent(PROXY) : undefined
    });
    return parseHtmlLatest(res.data)
}

async function getDetail(article) {
    const url = `${detail_base_url}` + encodeURIComponent(article.title.split(" ").map(v => v.toLowerCase()).join("-") + "-" + article.code)
    const response = await axios.get(url, {
        httpsAgent: PROXY ? new HttpsProxyAgent(PROXY) : undefined
    });
    const data = response.data;
    // fs.writeFileSync('./test.html', data)
    return parseHtml(data)

}

// 打印时加上时间戳
function log_with_time(...args) {
    // 打印带时间戳的消息
    const current_time = new Date().toISOString();
    console.log(`[${current_time}]`, ...args);
}

main().catch((err) => console.error('Error in monitor function:', err));
