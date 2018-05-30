const net = require('net');
const split = require('split');
import 'ignore-styles';

import {BigNumber} from 'bignumber.js';
import {hashClassConstructor, Dict32SetItem, Dict32Lookdict, Dict32Resize, HashClassGetItem, HashClassDelItem} from './src/chapter4_real_python_dict'; 

function restorePyDictState(state) {
    let self = hashClassConstructor();
    if (state.slots != null) {
        self.slots = state.slots.map(slot => {
            let key;
            if (slot.key === null || typeof slot.key === "number" || typeof slot.key === "string") {
                key = slot.key;
            } else if (typeof slot.key === "object" && slot.key.type == "DUMMY") {
                key = "DUMMY"; 
            } else {
                throw new Error(`Unknown key ${JSON.stringify(slot.key)}`);
            }

            return {
                hashCode: new BigNumber(slot.hashCode),
                key: key,
                value: slot.value,
            }
        });
    } else {
        self.slots = null;
    }
    self.used = state.used;
    self.fill = state.fill;

    return self;
}

function dumpPyDictState(self) {
    let data = {};

    data.slots = self.slots.map(slot => {
        let key;
        if (slot.key === "DUMMY") {
            key = {
                type: "DUMMY",
            }
        } else {
            key = slot.key;
        }

        return {
            hashCode: slot.hashCode != null ? +slot.hashCode.toString() : null,
            key: key,
            value: slot.value,
        }
    });
    data.used = self.used;
    data.fill = self.fill;

    return data;
}

const server = net.createServer(c => {
    console.log('Client connected');

    c.on('end', () => {
        console.log('Client disconnected');
    });

    c.pipe(split(JSON.parse)).on('data', (data) => {
        console.log("Received data");
        let self = restorePyDictState(data.self);
        // console.log(self);
        console.log(data.op, data.args.key, data.args.value)
        let isException = false;
        let result = null;
        // TODO: the whole thing is kinda ugly, encapsulate passing all these classes (e.g. Dict32Resize around)
        // TODO: isException() is really ugly, make .run() properly return exception
        switch (data.op) {
            case '__init__':
                self = hashClassConstructor();
                break;
            case '__getitem__': {
                let gi = new HashClassGetItem();
                result = gi.run(self, data.args.key, Dict32Lookdict);
                let giBreakpoints = gi.getBreakpoints();
                isException = (giBreakpoints[giBreakpoints.length - 1].point !== "return-value");
                break;
            }
            case '__setitem__': {
                let hcsi = new Dict32SetItem();
                self = hcsi.run(self, data.args.key, data.args.value, true, Dict32Resize, 4 /* FIXME */);
                break;
            }
            case '__delitem__': {
                let di = new HashClassDelItem();
                self = di.run(self, data.args.key, Dict32Lookdict);
                let diBreakpoints = di.getBreakpoints();
                isException = (diBreakpoints[diBreakpoints.length - 1].point !== "replace-value-empty");
                break;
            }
            default:
                throw new Error("Unknown op");
        }

        console.log("Writing response");
        c.write(JSON.stringify({
            exception: isException,
            result: result,
            self: dumpPyDictState(self),
        }) + "\n");
    });
});

server.on('error', (err) => {
    throw err;
});

server.on('listening', () => {
    console.log(`Listening`);
});

server.listen('pynode.sock', () => {
    console.log('Starting listening...');
});
