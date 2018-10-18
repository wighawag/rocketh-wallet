//import {ProviderEngine} from 'web3-provider-engine';
const ProviderEngine = require('web3-provider-engine')

console.log(ProviderEngine);

var requireAccount = {
	'eth_accounts': true,
	'eth_sendTransaction': true // todo sign via iframe + then sendRawTransaction
};

function HtmlProvider(trustedHost, readProvider) {
	
	this.readProvider = readProvider;
	this.loaded = false;
	this.counter = 0;
	this.callbacks = {};
	this.trustedHost = trustedHost;
	this.queue = []
	this.currentPopup = null
	 
	var iframeId = "__htmlprovider__";
	var currentIframe = document.getElementById(iframeId);
	
	if(!currentIframe){	
		currentIframe = document.createElement('iframe');
		document.body.appendChild(currentIframe);
	}else{
		window.removeEventListener("message", currentIframe.htmlProvider); 
	}
	
	this.iframe = currentIframe;
	this.iframe.htmlProvider = this;
	this.iframe.id = iframeId; 
	this.iframe.style.display = "none";
	
	var self = this;

	this.handleEvent = function(event){
		if(event.source != self.currentPopup && event.source != self.iframe.contentWindow){
			return;
		}
		if(event.type != "message" || (event.origin != self.trustedHost && self.trustedHost != "*")){ // TODO do not allow wildcard
			return;
		}

		console.log('receiving message : ', event.data);
		
		var data = event.data;
		if(data != "ready"){			
			var callback = self.callbacks[data.id];
			delete self.callbacks[data.id];
			callback(data.error, data.result);
		}
	}	
	
	window.addEventListener("message", this);
	
	
	this.iframe.onload = function(){
		console.log('iframe loaded');
		self.loaded = true;
		var arrayLength = self.queue.length;
		for (var i = 0; i < arrayLength; i++) {
			var data = self.queue[i];
			console.log('sending queued message : ', data.payload);
			self.sendAsync(data.payload,data.callback);
		}
		self.queue.length = 0;
	}
	this.iframe.src = (this.trustedHost == "*" ? "" : this.trustedHost) + "/iframe.html"; // TODO do not allow wildcard
	console.log('loading iframe with ' + this.iframe.src);
}


HtmlProvider.prototype.send = function (payload, callback) {
	console.log('send');
	if (callback) {
		if (requireAccount[payload.method]) {
			return this.sendAsync(payload, callback);
		} else {
			console.log('read send ');
			this.readProvider.send(payload, callback);
		}
	}
	throw "synchrnous call not supported"
};

HtmlProvider.prototype.privateAsync = function (payload, callback) {
	console.log('private async ');
	try {
		this.callbacks[this.counter] = callback;
		this.iframe.contentWindow.postMessage({id:this.counter, payload:payload}, this.trustedHost);
		this.counter++;
	} catch(e) {
		callback({message:'ERROR: Couldn\'t postMessage to iframe at '+ this.iframe.location.href,type:"error"});
	}
}

HtmlProvider.prototype.sendAsync = function (payload, callback) {
	console.log('sendAsync');
	if (requireAccount[payload.method]) {
		if(!this.loaded){
			this.queue.push({payload:payload,callback:callback});
			return;
		}
		this.privateAsync(payload, callback);
	} else {
		console.log('sendAsync to send ');
		this.readProvider.send(payload, callback);
	}
};


HtmlProvider.prototype.isConnected = function() {
	throw "synchrnous call not supported"
};

module.exports = HtmlProvider;
