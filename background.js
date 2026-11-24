chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      id: "redactle",
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { schemes: ["https"], hostEquals: "redactle.net" }
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);
  });
});
