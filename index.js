require('popper.js');
require('bootstrap');
require('bootstrap/dist/css/bootstrap.css');

var _ = require('lodash');

var React = require('react');
var ReactDOM = require('react-dom');

import {Chapter1_SimplifiedHash} from './chapter1_simplified_hash.js';
import {Chapter2_HashTableFunctions} from './chapter2_hash_table_functions.js';
import {Chapter3_HashClass} from './chapter3_hash_class.js';
import {Chapter4_RealPythonDict} from './chapter4_real_python_dict.js';

import ReactCSSTransitionReplace from 'react-css-transition-replace';
import CustomScroll from 'react-custom-scroll';

function logViewportStats() {
    console.log("window: " + window.innerWidth + "x" + window.innerHeight);
    console.log("document.documentElement: " + document.documentElement.clientWidth + "x" + document.documentElement.clientHeight);
}

class CrossFade extends React.Component {
    render() {
      return <ReactCSSTransitionReplace
        transitionName="cross-fade"
        transitionEnterTimeout={350} transitionLeaveTimeout={350}>
          {this.props.children}
      </ReactCSSTransitionReplace>
    }
}

class App extends React.Component {
    render() {
        return(
            <div>
              <h1> Inside python dict &mdash; an explorable explanation</h1>
              <Chapter1_SimplifiedHash />
              <Chapter2_HashTableFunctions />
              <Chapter3_HashClass />
              <Chapter4_RealPythonDict />
          </div>)
    }
}

$(document).ready(function() {
    logViewportStats();
    /* TODO: properly apply stickyfill */
    /*let elements = $('.sticky-top');
    Stickyfill.add(elements);*/

    ReactDOM.render(
      <App />,
      document.getElementById('root')
    );
});
