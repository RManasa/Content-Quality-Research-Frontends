(function() {

    if(window.workingOnParsing)
        return;

    window.workingOnParsing = true;

    function initializeParser(href) {
        if(href.includes('wiki')) {
            return new WikiParser();
        } else if(href.includes('brainly')) {
            return new BrainlyParser();
        } else if(site_href.includes('answers.com')) {
            return new AnswersParser();
        } else if(site_href.includes('reddit')) {
            return new RedditParser();
        } else if(site_href.includes('answerbag')) {
            return new AnswerbagParser();
        } else if(site_href.includes('stackexchange') || site_href.includes('stackoverflow')) {
            return new StackExchangeParser();
        }
    }

    function resolvePageSource(data) {
        chrome.runtime.sendMessage({
            action: "get_source",
            data: data
        });
    }

    let hostname = location.hostname;
    let site_href = location.href;
    let source = hostname.substr(hostname.lastIndexOf(".") + 1);

    // Initialize the page parses based on the respective page
    // and collect the data that is common for all pages.
    let parser = initializeParser(site_href);
    let data = {
        //full: parser.DOMToString(),
        href: site_href,
        domain: hostname,
        source: source,
        time: Date.now()
    };

    try {

        let resolveImmediately = true;
        if(site_href.includes('wiki')) {
            data.scraped = parser.getParsedWikiPage(['.mw-parser-output', '#mw-content-text']);
        } else if(site_href.includes('brainly')) {
            data.scraped = parser.getParsedBrainlyPage();
            new BrainlyModifier().modifyPageSource();
        } else if(site_href.includes('answers')) {
            data.scraped = parser.getParsedAnswersPage();
        } else if(site_href.includes('reddit')) {
            resolveImmediately = false;
            parser.getParsedRedditPage()
                .then(parsed_reddit_page => {
                    data.scraped = parsed_reddit_page;
                    resolvePageSource(data);
                });
        } else if(site_href.includes('answerbag')) {
            data.scraped = parser.getParsedAnswerbagPage();
        } else if(site_href.includes('stackexchange') || site_href.includes('stackoverflow')) {
            data.scraped = parser.getParsedStackExchangePage();
        }
        
        if(resolveImmediately)
            resolvePageSource(data);

    } catch(error) {
        chrome.runtime.sendMessage({
            action: "get_source",
            'error': error.message
        });
    }
})();