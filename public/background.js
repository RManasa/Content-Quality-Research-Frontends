chrome.runtime.onInstalled.addListener(function() {
    console.log('The extension was installed');
});

function createMenus() {
    chrome.contextMenus.create({
        id: "question_selection",
        title: "Select question",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "answer_selection",
        title: "Select answer",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "eval",
        title: "Evaluate",
        contexts: ["page", "selection"]
    });

    chrome.contextMenus.create({
        id: "answer_selection_eval",
        title: "Select answer and evaluate",
        contexts: ["selection"]
    });
}

createMenus();

var windowId = null;
var popupTabId = 0;
function createPopupWindow() {
    let width = 400;
    let height = 800;
    chrome.windows.create({
        url: "index.html",
        type: "popup",
        left: window.screen.availWidth - width,
        top: 0,
        width: width,
        height: height
    }, function(window) {
        windowId = window.id;

        // Get the tab id as well
        chrome.tabs.query({'windowId' : windowId}, 
            (tabs) => popupTabId = tabs[0].id);
    });
}

//TODO: Implement update function
function updatePopupWindow(collected_data, response) {
    console.log('updating window')
    // console.log(collected_data)
    chrome.storage.sync.set({'collected': collected_data, 'response': response}, function() {
        chrome.tabs.reload(popupTabId, function() {
            // The popup window no longer exists, create it
            if(chrome.runtime.lastError)
                createPopupWindow();
        });
    });
}

chrome.contextMenus.onClicked.addListener(function(selectedMenuItem, tab) {
    if(selectedMenuItem.menuItemId === "question_selection") {
        console.log('Question selected');
        chrome.tabs.executeScript(null, {file: "helper_scripts/save_question.js"}, function() {
            chrome.notifications.create(null, {
                type: "basic",
                iconUrl: "images/get_started32.png",
                title: "Q&A Quality",
                message: "Question was updated."
            }, function(id) {
                chrome.notifications.clear(id);
            });
        });
    } else if(selectedMenuItem.menuItemId === "answer_selection") {
        console.log("Answer selected");
        chrome.tabs.executeScript(null, {file: "helper_scripts/save_answer.js"}, function() {
            chrome.notifications.create(null, {
                type: "basic",
                iconUrl: "images/get_started32.png",
                title: "Q&A Quality",
                message: "Answer was updated"
            }, function(id) {
                chrome.notifications.clear(id);
            });
        });
    } else if(selectedMenuItem.menuItemId === "eval") {
        console.log("Evaluating");
        createPopupWindow();
    } else if(selectedMenuItem.menuItemId === "answer_selection_eval") {
        console.log("Answer selected and evaluation will be executed");
        chrome.tabs.executeScript(null, {file: "helper_scripts/save_answer.js"}, function(response) {
            createPopupWindow();
        });
    }
});

function inject_all_scripts(tab_id, script_list) {
    chrome.tabs.executeScript(tab_id, {file: script_list[0]}, function() {
        script_list.shift();
        if(script_list.length > 0) {
            inject_all_scripts(tab_id, script_list);
        }
    });
}

function requestSource() {
    if(!location.href.includes('chrome://')) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            inject_all_scripts(tabs[0].id, [
                "libs/jquery.min.js", 
                "helper_scripts/parsers.js", 
                "helper_scripts/parse_document.js"
            ]);
        });
    }
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('activated');
    requestSource();
});

chrome.tabs.onCreated.addListener(function(activeInfo) {
    console.log('created');
    requestSource();
});

chrome.tabs.onUpdated.addListener(function(activeInfo) {
    console.log('updated');
    requestSource();
});

function checkAvailability(data, url) {
    var lastSlash = url.lastIndexOf('/');
    var lastAnd = url.lastIndexOf('&');
    var lastQuestion = url.lastIndexOf('?');

    var maxIndex = Math.max(Math.max(lastAnd, lastQuestion), lastSlash);
    if(maxIndex === -1) {
        data.availability = {url: '', closest: {available: false, timestamp: 0}};
        sendTestingData(data);
    } else {
        // console.log(url);

        $.ajax({
            'url': url,
            success: function(response) {
                console.log(response)
                if(response.archived_snapshots && response.archived_snapshots.closest) {
                    data.availability = response;
                    sendTestingData(data);
                } else {
                    checkAvailability(data, url.substring(0, maxIndex));
                } 
            },
            error: function(response) {
                console.log(response);
                // TODO: Handle error through UI as well
                data.availability = {url: '', closest: {available: false, timestamp: 0}};
                sendTestingData(data);
            }
          });
    }
}

function sendTestingData(payload) {
    console.log(payload)

    if(!payload.brainly_data || payload.brainly_data.all_answers.length < 1)
        return;
    
    console.log('sending to server');
    $.ajax({
        type: 'POST',
        url: 'http://localhost:8000/reliability/collect_data',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        // The Django server expects JSON payloads as a String then parses it using json.loads(payload)
        data: JSON.stringify(payload),
        success: function(response) {
            console.log(response);
            updatePopupWindow(payload, response);
        },
        failure: function(response) {
            console.log(response);
            updatePopupWindow(payload, response);
        }
    })
}

chrome.runtime.onMessage.addListener(function(request, sender) {
    if (request.action == "get_source") {
        if(chrome.runtime.lastError || request.error) {
            console.log('not got source')
            console.log(request.error);
        } else {
            console.log('got source')
            // console.log(request.data);
        
            let startingUrl = 'http://archive.org/wayback/available?url=' + request.data.href;
            checkAvailability(request.data, startingUrl);
        }
    } 
    else if(request.action == "get_availability") {
        console.log('got availability')
        console.log(request.data);

        sendTestingData(request.data);
    } 
});