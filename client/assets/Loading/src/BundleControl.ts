import Configs from "./Configs";
import { Global } from "./Global";

export default class BundleControl {
    static serverVersion: any = {};

    static init(data) {
        this.serverVersion = data;
        // let dataTest = '{ "BaCay": { "hash": "6c91c", "url": "https://hit3s.fun/assets/BaCay" }, "BackupRes": { "hash": "59f9e", "url": "https://hit3s.fun/assets/BackupRes" }, "BaiCao": { "hash": "745af", "url": "https://hit3s.fun/assets/BaiCao" }, "BauCua": { "hash": "006b1", "url": "https://hit3s.fun/assets/BauCua" }, "CaoThap": { "hash": "74b61", "url": "https://hit3s.fun/assets/CaoThap" }, "internal": { "hash": "604e0", "url": "https://hit3s.fun/assets/internal" }, "Lieng": { "hash": "e4c86", "url": "https://hit3s.fun/assets/Lieng" }, "Lobby": { "hash": "f6fed", "url": "https://hit3s.fun/assets/Lobby" }, "Loto": { "hash": "83290", "url": "https://hit3s.fun/assets/Loto" }, "main": { "hash": "aa574", "url": "https://hit3s.fun/assets/main" }, "MauBinh": { "hash": "9e18d", "url": "https://hit3s.fun/assets/MauBinh" }, "migration": { "hash": "205da", "url": "https://hit3s.fun/assets/migration" }, "MiniPoker": { "hash": "7ef87", "url": "https://hit3s.fun/assets/MiniPoker" }, "OanTuTi": { "hash": "dd67d", "url": "https://hit3s.fun/assets/OanTuTi" }, "Poker": { "hash": "bbcc5", "url": "https://hit3s.fun/assets/Poker" }, "resources": { "hash": "ce096", "url": "https://hit3s.fun/assets/resources" }, "Sam": { "hash": "8853d", "url": "https://hit3s.fun/assets/Sam" }, "ScriptCore": { "hash": "6659c", "url": "https://hit3s.fun/assets/ScriptCore" }, "ShootFish": { "hash": "f3fee", "url": "https://hit3s.fun/assets/ShootFish" }, "Slot1": { "hash": "5a22d", "url": "https://hit3s.fun/assets/Slot1" }, "Slot10": { "hash": "bdf81", "url": "https://hit3s.fun/assets/Slot10" }, "Slot2": { "hash": "ca374", "url": "https://hit3s.fun/assets/Slot2" }, "Slot3": { "hash": "86863", "url": "https://hit3s.fun/assets/Slot3" }, "Slot3x3": { "hash": "818af", "url": "https://hit3s.fun/assets/Slot3x3" }, "Slot4": { "hash": "c3590", "url": "https://hit3s.fun/assets/Slot4" }, "Slot5": { "hash": "cf326", "url": "https://hit3s.fun/assets/Slot5" }, "Slot7": { "hash": "c0473", "url": "https://hit3s.fun/assets/Slot7" }, "Slot8": { "hash": "deae4", "url": "https://hit3s.fun/assets/Slot8" }, "Slot9": { "hash": "11666", "url": "https://hit3s.fun/assets/Slot9" }, "TaiXiuDouble": { "hash": "f78ee", "url": "https://hit3s.fun/assets/TaiXiuDouble" }, "TienLen": { "hash": "050ad", "url": "https://hit3s.fun/assets/TienLen" }, "XiDach": { "hash": "c35d2", "url": "https://hit3s.fun/assets/XiDach" }, "XocDia": { "hash": "af76c", "url": "https://hit3s.fun/assets/XocDia" }, "FbConfig": { "isShowBtnFb":false } }';
        // this.serverVersion = JSON.parse(dataTest);
    }

    static loadSceneGame(bundleName, sceneName, callbackProgress, bundleCallback) {
        this.loadBundle(bundleName, bundle => {
            bundle.loadScene(sceneName, function (finish, total, item) {
                callbackProgress(finish, total);
            }, function (err1, scene) {
                cc.director.preloadScene(sceneName, (c, t, item) => {
                    callbackProgress(c, t);
                }, (err, sceneAsset) => {
                    cc.director.loadScene(sceneName);
                    bundleCallback();
                });
            });
        })
    }

    static loadPrefabGame(bundleName, prefabName, callbackProgress, bundleCallback) {
        this.loadBundle(bundleName, bundle => {
            bundle.load(prefabName, cc.Prefab, function (finish, total, item) {
                callbackProgress(finish, total);
            }, function (err1, prefab) {
                bundleCallback(prefab, bundle);
            });
        })
    }

    static loadBundle(bundleName, bundleCallback) {
        if (Configs.App.IS_LOCAL) {
            var url = bundleName;
            cc.assetManager.loadBundle(url, (err, bundle) => {
                if (err != null) {
                    // errorCallback(err);
                      cc.log("Error Donwload bundle:" + JSON.stringify(err));
                    return;
                }
                bundleCallback(bundle);
            });
        } else {
            var bundleVersion = this.serverVersion ? this.serverVersion[bundleName] : null;
            var url = bundleName;
            if (bundleVersion && cc.sys.isNative) {
                url = bundleVersion.url;
            }
            // url = "http://192.168.100.5:8700/remote/" + bundleName
            if (bundleVersion && bundleVersion.hash) {
                cc.assetManager.loadBundle(url, { version: bundleVersion.hash }, (err, bundle) => {
                    if (err != null) {
                        cc.log("Error Donwload bundle with version:" + JSON.stringify(err));
                        return;
                    }
                    bundleCallback(bundle);
                });
            } else {
                // Fallback: if bundle version data is missing, still try local/normal bundle name.
                cc.log("Bundle version missing, fallback load bundle by name: " + bundleName);
                cc.assetManager.loadBundle(url, (err, bundle) => {
                    if (err != null) {
                        cc.log("Error Donwload bundle fallback:" + JSON.stringify(err));
                        return;
                    }
                    bundleCallback(bundle);
                });
            }
        }

    }
    static loadPrefabPopup(prefabPath, cb) {
        Global.BundleLobby.load(prefabPath, (err, prefab) => {
            if (err) {
                //  cc.log("Err load prefab bundle:", err);
                return;
            } else {
                //  cc.log("loadPrefabPopup Success");
                cb(prefab);
            }
        });
    }

}
