const ProviderEngine = require('web3-provider-engine')
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js')
const FixtureSubprovider = require('web3-provider-engine/subproviders/fixture.js')
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js')
const VmSubprovider = require('web3-provider-engine/subproviders/vm.js')
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js')
const NonceSubprovider = require('web3-provider-engine/subproviders/nonce-tracker.js')
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
const util = require('util');

util.inherits(HtmlProvider, ProviderEngine)

function HtmlProvider(trustedHost, readURL, opts) {
	var self = this;
	this.readURL = readURL;
	this.opts = opts || {};
	HtmlProvider.super_.call(self, this.opts.engine);

	this.loaded = false;
	this.counter = 1;
	this.callbacks = {};
	this.trustedHost = trustedHost;
	this.iframeURL = trustedHost + "/iframe.html";
	
	this.queue = []
	 
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

	this.pendingUserConfirmation = null;

	this.handleEvent = function(event){
		if(event.source != self.iframe.contentWindow || event.origin != self.trustedHost){
			// ignore message not coming from the iframe
			return;
		}

		if(event.type != "message") {
			console.error('only message expected from ' + self. trustedHost);
			return;
		}

		var data = event.data;
		if (!data.error && data.requireUserConfirmation) {
			this.iframe.style.display = "block";

			if (this.pendingUserConfirmation) {
				self.executeCallback(this.pendingUserConfirmation.id, 'overriden by new user \'s confirmation request', null);		
			}

			this.pendingUserConfirmation = {
				id: data.id,
				payload: data.result
			};
			
		} else {
			if(this.pendingUserConfirmation && this.pendingUserConfirmation.id == data.id) {
				this.iframe.style.display = "none";
				this.pendingUserConfirmation = null;
			}
			self.executeCallback(data.id, data.error, data.result);
		}
	}	
	
	window.addEventListener("message", this);
	
	
	this.iframe.onload = function(){
		self.loaded = true;
		var arrayLength = self.queue.length;
		for (var i = 0; i < arrayLength; i++) {
			var data = self.queue[i];
			self.sendToIFrame(data.payload,data.callback);
		}
		self.queue.length = 0;
	}

	function fetchXTimes(url) {
		return fetch(url).then(function(response){
			if(Math.random() > 0.5) { // TODO crypto random
				return fetch(url);	
			}
			return response;
		});
	}

	fetchXTimes(this.iframeURL).then(function(response){
		if(response.body != "") { // TODO equality via hash ?
			self.iframe.src = self.iframeURL;
		} else {
			console.error('SECURITY ALERT', response.body.toString());
			// TODO log alert to the world
		}
	})
	.catch(function(error){
		console.error('FAILED TO LOAD IFRAME CONTENT', error);
	})

	this.setupEngine();
	
}

HtmlProvider.prototype.executeCallback = function(id, error, result) {
	var callback = this.callbacks[id];
	delete this.callbacks[id];
	callback(error, result);
}

HtmlProvider.prototype.enable = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		console.log('ENABLING');
		self.sendToIFrame({id:self.counter++, jsonrpc:"2.0", method:'enable', params:[]}, function(error, result){
			if(error) {
				reject();
			} else {
				resolve(result);
			}
		});
	});
}

HtmlProvider.prototype.sendToIFrame = function (payload, callback) {
	if(!this.loaded){
		this.queue.push({payload:payload,callback:callback});
		return;
	}

	try {
		this.callbacks[payload.id] = callback;
		this.iframe.contentWindow.postMessage(payload, this.trustedHost);
	} catch(e) {
		callback({message:'ERROR: Couldn\'t postMessage to iframe at '+ this.iframe.location.href,type:"error"});
	}
};

HtmlProvider.prototype.setupEngine = function() {
	var self = this;

	// static results
	this.addProvider(new FixtureSubprovider({
		web3_clientVersion: 'ProviderEngine/v0.0.0/javascript',
		net_listening: true,
		eth_hashrate: '0x00',
		eth_mining: false,
		eth_syncing: true,
	}))
	
	// cache layer
	this.addProvider(new CacheSubprovider())
	
	// filters
	this.addProvider(new FilterSubprovider())
	
	// pending nonce
	this.addProvider(new NonceSubprovider())
	
	// vm
	this.addProvider(new VmSubprovider())
	
	// id mgmt
	this.addProvider(new HookedWalletSubprovider({
		getAccounts: function(cb){
			self.sendToIFrame({id:self.counter++, jsonrpc:"2.0", method:'eth_accounts', params:[]}, function(error, result) {
				cb(error, result);
			});
		},
		signTransaction: function(txData, cb){
			if (txData.gas !== undefined) txData.gasLimit = txData.gas
    		txData.value = txData.value || '0x00'
			if(txData.data && !(txData.data[0] == '0' && txData.data[1] == 'x')) {
				txData.data = '0x' + txData.data;	
			}
			self.sendToIFrame({id:self.counter++, jsonrpc:"2.0", method:'eth_signTransaction', params:[txData]}, function(error, result) {
				cb(error, result);
			});
		},
		signMessage: function(msgParams, cb) {
			self.sendToIFrame({id:self.counter++, jsonrpc:"2.0", method:'eth_signMessage', params:[msgParams.from, msgParams.data]}, function(error, result) {
				cb(error, result);
			});	
		}
	}))
	
	// data source
	this.addProvider(new RpcSubprovider({
		rpcUrl: self.readURL,
	}))
	
	// network connectivity error
	this.on('error', function(err){
		// report connectivity errors
		console.error(err.stack)
	})
	
	// start polling for blocks
	this.start()
}


module.exports = HtmlProvider;
