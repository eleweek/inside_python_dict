import {observable, action} from 'mobx';

export let globalSettings = observable({
    codePlaySpeed: 1,
});

globalSettings.setCodePlaySpeed = action(function setCodePlaySpeed(speed) {
    console.log('action setCodePlaySpeed', speed);
    globalSettings.codePlaySpeed = speed;
});
