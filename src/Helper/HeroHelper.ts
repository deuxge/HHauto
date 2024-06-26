import { addNutakuSession, autoLoop } from '../Service/index';
import { getHHAjax, isJSON, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey } from '../config/index';
import { KKHero } from '../model/index';
import { ConfigHelper } from './ConfigHelper';
import { getHHVars } from "./HHHelper";
import { getStoredValue, setStoredValue } from "./StorageHelper";
import { randomInterval } from "./TimeHelper";

export function getHero():KKHero
{
    if(unsafeWindow.Hero === undefined && unsafeWindow.shared?.Hero === undefined)
    {
        setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+"Temp_autoLoopTimeMili")))
        //logHHAuto(window.wrappedJSObject)
    }
    //logHHAuto(unsafeWindow.Hero);
    return unsafeWindow.Hero || unsafeWindow.shared?.Hero;
}

export function doStatUpgrades()
{
    //Stats?
    //logHHAuto('stats');
    var Hero=getHero();
    var stats=[getHHVars('Hero.infos.carac1'),getHHVars('Hero.infos.carac2'),getHHVars('Hero.infos.carac3')];
    var money = HeroHelper.getMoney();
    var count=0;
    var M=Number(getStoredValue(HHStoredVarPrefixKey+"Setting_autoStats"));
    var MainStat = stats[HeroHelper.getClass() -1];
    var Limit = HeroHelper.getLevel() * 30;//HeroHelper.getLevel()*19+Math.min(HeroHelper.getLevel(),25)*21;
    var carac = HeroHelper.getClass();
    var mp=0;
    var mults=[60,30,10,1];
    for (var car=0; car<3; car++)
    {
        //logHHAuto('stat '+carac);
        var s=stats[carac-1];
        for (var mu=0;mu<5;mu++)
        {
            var mult=mults[mu];
            var price = 5+s*2+(Math.max(0,s-2000)*2)+(Math.max(0,s-4000)*2)+(Math.max(0,s-6000)*2)+(Math.max(0,s-8000)*2);
            price*=mult;
            if (carac == HeroHelper.getClass())
            {
                mp=price;
            }
            //logHHAuto('money: '+money+' stat'+carac+': '+stats[carac-1]+' price: '+price);
            if ((stats[carac-1]+mult)<=Limit && (money-price)>M && (carac==HeroHelper.getClass() || price<mp/2 || (MainStat+mult)>Limit))
            {
                count++;
                logHHAuto('money: '+money+' stat'+carac+': '+stats[carac-1]+' [+'+mult+'] price: '+price);
                money-=price;
                var params = {
                    carac: "carac" + carac,
                    action: "hero_update_stats",
                    nb: mult
                };
                getHHAjax()(params, function(data) {
                    Hero.update("soft_currency", 0 - price, true);
                });
                setTimeout(doStatUpgrades, randomInterval(300,500));
                return;
                break;
            }
        }
        carac=(carac+1)%3+1;
    }
}

export class HeroHelper {

    static getPlayerId():number {
        return getHHVars('Hero.infos.id');
    }

    static getClass():number {
        return getHHVars('Hero.infos.class');
    }

    static getLevel():number {
        return getHHVars('Hero.infos.level');
    }

    static getMoney():number {
        return getHHVars('Hero.currencies.soft_currency');
    }

    static getKoban():number {
        return getHHVars('Hero.currencies.hard_currency');
    }

    static haveBoosterInInventory(idBooster:string) {
        const HaveBooster=isJSON(getStoredValue(HHStoredVarPrefixKey+"Temp_haveBooster"))?JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_haveBooster")):{};
        const boosterOwned = HaveBooster.hasOwnProperty(idBooster) ? Number(HaveBooster[idBooster]) : 0;
        return boosterOwned > 0
    }

    static async equipBooster(booster:any):Promise<boolean> {
        if(!booster) return Promise.resolve(false);
        if(!HeroHelper.haveBoosterInInventory(booster.identifier)) {
            logHHAuto("Booster " + booster + " not in inventory");
            return Promise.resolve(false);
        }
        let itemId = ConfigHelper.getHHScriptVars("boosterId_" + booster.identifier, false);
        if (!itemId) {
            itemId = booster.id_item;
        }
        //action=market_equip_booster&id_item=316&type=booster
        setStoredValue(HHStoredVarPrefixKey+"Temp_autoLoop", "false");
        logHHAuto("Equip "+booster.name+", setting autoloop to false");
        const params = {
            action: "market_equip_booster",
            id_item: itemId,
            type: "booster"
        };

        return new Promise((resolve) => {
            // change referer
            const currentPath = window.location.href.replace('http://', '').replace('https://', '').replace(window.location.hostname, '');
            window.history.replaceState(null, '', addNutakuSession('/shop.html') as string);
            getHHAjax()(params, function(data) {
                if (data.success) logHHAuto('Booster equipped');
                else HeroHelper.getSandalWoodEquipFailure(true); // Increase failure
                setStoredValue(HHStoredVarPrefixKey+"Temp_autoLoop", "true");
                setTimeout(autoLoop,randomInterval(500,800));
                resolve(true);
            }, function (err){
                logHHAuto('Error occured booster not equipped, could be booster is already equipped');
                setStoredValue(HHStoredVarPrefixKey+"Temp_autoLoop", "true");
                setTimeout(autoLoop,randomInterval(500,800));
                HeroHelper.getSandalWoodEquipFailure(true); // Increase failure
                resolve(false);
            });
            // change referer
            window.history.replaceState(null, '', addNutakuSession(currentPath) as string);
        });

    }

    static getSandalWoodEquipFailure(increase:boolean=false){
        const numberFailureStr:string = getStoredValue(HHStoredVarPrefixKey+"Temp_sandalwoodFailure") ?? '0';
        let numberFailure = numberFailureStr ? Number(numberFailureStr): 0;
        if(isNaN(numberFailure)) numberFailure = 0;
        if(increase) numberFailure = numberFailure + 1;
        setStoredValue(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", numberFailure);
        return numberFailure;
    }
}