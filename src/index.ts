import { DOMSource, VNode, makeDOMDriver, div, pre, strong } from "@cycle/dom";
import { run } from "@cycle/run";
import { TimeSource, timeDriver } from "@cycle/time";
import xs, { Stream } from "xstream";

import {main} from "./app";
const drivers = {
  DOM: makeDOMDriver(".app"),
  Time: timeDriver
};

run(main, drivers);
