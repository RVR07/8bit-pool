var Wallet = {
  CHAIN_ID: '0x14a34',
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  account: null,
  raw: null,
  notice: '',
  announced: [],

  remember: function (detail) {
    if (!detail || !detail.info || !detail.provider) return;
    for (var i = 0; i < this.announced.length; i++) {
      if (this.announced[i].info.uuid === detail.info.uuid) {
        this.announced[i] = detail;
        return;
      }
    }
    this.announced.push(detail);
  },

  provider: function () {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    for (var i = 0; i < this.announced.length; i++) {
      if (this.announced[i].info.rdns === 'io.metamask') return this.announced[i].provider;
    }
    var eth = window.ethereum;
    if (!eth) return null;
    var list = eth.providers || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].isMetaMask && !list[j].isBraveWallet && !list[j].isOkxWallet) return list[j];
    }
    if (eth.isMetaMask && !eth.isBraveWallet && !eth.isOkxWallet) return eth;
    return null;
  },

  codeOf: function (err) {
    if (!err) return 0;
    if (typeof err.code === 'number') return err.code;
    if (err.data && err.data.originalError && typeof err.data.originalError.code === 'number') {
      return err.data.originalError.code;
    }
    var parsed = Number(err.code);
    return parsed || 0;
  },

  connect: function () {
    var provider = this.provider();
    var self = this;
    this.notice = '';
    if (!provider) return Promise.reject(new Error('Install MetaMask'));
    this.listen(this.onChange);
    return provider.request({ method: 'eth_requestAccounts', params: [] }).then(function (accounts) {
      if (!accounts || !accounts.length) throw new Error('No account');
      self.account = accounts[0];
      return self.useBase(provider).catch(function (err) {
        var code = self.codeOf(err);
        if (code === 4001) self.notice = 'Switch to Base Sepolia';
        else if (code === -32002) self.notice = 'Check MetaMask';
        else self.notice = 'Switch to Base Sepolia';
      });
    }).then(function () {
      if (!self.account) return;
      return self.readBalance().catch(function () {
        self.raw = null;
      });
    });
  },

  useBase: function (provider) {
    var self = this;
    var addChain = function () {
      return provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: self.CHAIN_ID,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org']
        }]
      });
    };
    return provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: self.CHAIN_ID }]
    }).catch(function (err) {
      if (self.codeOf(err) !== 4902) throw err;
      return addChain();
    });
  },

  readBalance: function () {
    var provider = this.provider();
    var self = this;
    if (!provider || !this.account) return Promise.resolve();
    var data = '0x70a08231' + this.account.slice(2).toLowerCase().padStart(64, '0');
    return provider.request({
      method: 'eth_call',
      params: [{ to: this.USDC, data: data }, 'latest']
    }).then(function (hex) {
      self.raw = (!hex || hex === '0x') ? 0n : BigInt(hex);
    });
  },

  restore: function () {
    var provider = this.provider();
    var self = this;
    if (!provider) return Promise.resolve();
    return provider.request({ method: 'eth_accounts' }).then(function (accounts) {
      if (!accounts || !accounts.length) return;
      return provider.request({ method: 'eth_chainId' }).then(function (chainId) {
        self.account = accounts[0];
        if (parseInt(chainId, 16) !== 0x14a34) {
          self.raw = null;
          self.notice = 'Switch to Base Sepolia';
          return;
        }
        self.notice = '';
        return self.readBalance();
      });
    }).catch(function () {});
  },

  disconnect: function () {
    this.account = null;
    this.raw = null;
    this.notice = '';
  },

  listen: function (onChange) {
    if (onChange) this.onChange = onChange;
    var provider = this.provider();
    var self = this;
    if (!provider || provider._billiardsBound || !provider.on) return;
    provider._billiardsBound = true;
    function notify() {
      if (self.onChange) self.onChange();
    }
    provider.on('accountsChanged', function (accounts) {
      if (!accounts || !accounts.length) {
        self.disconnect();
        notify();
        return;
      }
      self.account = accounts[0];
      self.readBalance().then(notify, notify);
    });
    provider.on('chainChanged', function () {
      window.location.reload();
    });
  },

  drawFace: function (canvas, address) {
    if (!canvas || !address) return;
    var seed = address.toLowerCase().replace(/^0x/, '');
    function bite(i) {
      return parseInt(seed.charAt(i % seed.length), 16);
    }
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    var hue = bite(0) * 22 + bite(1);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'hsl(' + hue + ', 32%, 16%)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'hsl(' + hue + ', 62%, 68%)';
    var cells = 5;
    var pad = Math.round(size * 0.14);
    var cell = (size - pad * 2) / cells;
    for (var y = 0; y < cells; y++) {
      for (var x = 0; x < 3; x++) {
        if ((bite(4 + y * 3 + x) + y) % 2 === 0) continue;
        var cols = x === 2 ? [x] : [x, cells - 1 - x];
        for (var m = 0; m < cols.length; m++) {
          ctx.fillRect(pad + cols[m] * cell + 0.5, pad + y * cell + 0.5, cell - 1, cell - 1);
        }
      }
    }
  },

  paint: function (address) {
    var canvas = document.getElementById('profile_face');
    var mark = document.getElementById('profile_silhouette');
    if (!canvas || !mark) return;
    if (!address) {
      canvas.classList.add('hide');
      mark.classList.remove('hide');
      return;
    }
    this.drawFace(canvas, address);
    mark.classList.add('hide');
    canvas.classList.remove('hide');
  },

  short: function (address) {
    if (!address) return '';
    return address.slice(0, 6) + '…' + address.slice(-4);
  },

  format: function (raw) {
    if (raw === null || typeof raw === 'undefined') return '—';
    var value = raw < 0n ? -raw : raw;
    var whole = value / 1000000n;
    var cents = (value % 1000000n) / 10000n;
    var text = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var frac = cents.toString();
    if (frac.length < 2) frac = '0' + frac;
    return (raw < 0n ? '-' : '') + text + '.' + frac;
  }
};

window.addEventListener('eip6963:announceProvider', function (event) {
  Wallet.remember(event.detail);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
