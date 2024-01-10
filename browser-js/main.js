window.sodium = {
  onload: function (sodium) {

    /* --------- Put your custom code here --------- */

    let tiplinkIndex = 1;

    document.getElementById('create_tiplink_btn').addEventListener("click", () => createTipLink());

    async function createTipLink() {
      const link = await TipLink.create();

      document.getElementById('tiplink_container').innerHTML += '<a target="_blank" href="' + link.url.toString() + '">Go to TipLink ' + tiplinkIndex + '</a><br>';

      tiplinkIndex++;
    }

    /* --------- End of custom code --------- */

    var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = (this && this.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    const DEFAULT_TIPLINK_KEYLENGTH = 12;
    const TIPLINK_ORIGIN = "https://tiplink.io";
    const TIPLINK_PATH = "/i";
    const kdf = (fullLength, pwShort, salt) => __awaiter(void 0, void 0, void 0, function* () {
      return sodium.crypto_pwhash(fullLength, pwShort, salt, sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_DEFAULT);
    });
    const randBuf = (l) => __awaiter(void 0, void 0, void 0, function* () {
      return sodium.randombytes_buf(l);
    });
    const kdfz = (fullLength, pwShort) => __awaiter(void 0, void 0, void 0, function* () {
      const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES);
      return yield kdf(fullLength, pwShort, salt);
    });
    const pwToKeypair = (pw) => __awaiter(void 0, void 0, void 0, function* () {
      const seed = yield kdfz(sodium.crypto_sign_SEEDBYTES, pw);
      return (solanaWeb3.Keypair.fromSeed(seed));
    });
    class TipLink {
      constructor(url, keypair) {
        this.url = url;
        this.keypair = keypair;
      }
      static create() {
        return __awaiter(this, void 0, void 0, function* () {
          const b = yield randBuf(DEFAULT_TIPLINK_KEYLENGTH);
          const keypair = yield pwToKeypair(b);
          const hash = (0, binary_to_base58)(b);
          const urlString = `${TIPLINK_ORIGIN}${TIPLINK_PATH}#${hash}`;
          // can't assign hash as it causes an error in React Native
          const link = new URL(urlString);
          const tiplink = new TipLink(link, keypair);
          return tiplink;
        });
      }
      static fromUrl(url) {
        return __awaiter(this, void 0, void 0, function* () {
          const slug = url.hash.slice(1);
          const pw = Uint8Array.from((0, base58_to_binary)(slug));
          const keypair = yield pwToKeypair(pw);
          const tiplink = new TipLink(url, keypair);
          return tiplink;
        });
      }
      static fromLink(link) {
        return __awaiter(this, void 0, void 0, function* () {
          const url = new URL(link);
          return this.fromUrl(url);
        });
      }
    }
  }
}
