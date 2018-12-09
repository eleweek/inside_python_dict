import {observable, action} from 'mobx';

export let globalSettings = observable({
    codePlaySpeed: 1,
    maxCodePlaySpeed: 16,
});

globalSettings.setCodePlaySpeed = action(function setCodePlaySpeed(speed) {
    console.log('action setCodePlaySpeed', speed);
    globalSettings.codePlaySpeed = speed;
});

globalSettings.setMaxCodePlaySpeed = action(function setCodePlaySpeed(maxSpeed) {
    console.log('action setMaxCodePlaySpeed', maxSpeed);
    globalSettings.maxCodePlaySpeed = maxSpeed;
});

export let scroll = observable({
    scrollY: 0,
});

scroll.setScrollY = action(function setScrollY(scrollY) {
    scroll.scrollY = scrollY;
});
