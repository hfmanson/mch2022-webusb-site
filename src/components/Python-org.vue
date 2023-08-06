<template> 
  <section id='python'>
    <mdb-card class='mb-4' ondrop='itemDrop'>
      <mdb-card-body>
        <section>
          <mdb-row>
            <mdb-col sm='2' md='2' lg='2'>
              <mdb-btn color='gray' size='lg' title='Run file' v-on:click='runfile_ui()' icon='play'></mdb-btn>
              <mdb-btn color='gray' size='lg' title='Save file' v-on:click='save_ui()' icon='save'></mdb-btn>
            </mdb-col>
          </mdb-row>
          <mdb-row class='mt-3'>
            <mdb-col sm='6' md='8' lg='9'>
              <editor v-model='content_editor' lang='python' theme='monokai' height='500'></editor>
            </mdb-col>
          </mdb-row>
          </section>
      </mdb-card-body>
    </mdb-card>
      <mdb-card class='mb-4'>
      <mdb-card-body>
        <section>
              Python terminal
              <div class="md-form">
                  <Terminal ref="terminal" v-on:data="commandpython"></Terminal>
              </div>
        </section>
      </mdb-card-body>
    </mdb-card>
  </section>
</template>

<script>
window.itemDrop = function() {
  console.log('nope')
};

import {mdbToastNotification, mdbBtn, mdbCard, mdbCardBody, mdbCol, mdbRow} from 'mdbvue';
  import {connect, on_connect, runfile, readfile, savefile, fetch_dir, createfolder, savetextfile, movefile, delfile, deldir, createfile, registerstdout, writetostdin, downloaddir} from '../webusb';
import * as $ from 'jquery';
import * as ace from 'brace';
import 'brace/mode/python';
import 'brace/theme/monokai';
import * as ace_editor from 'vue2-ace-editor';
import { saveAs } from 'file-saver';
import * as JSZip from 'jszip';
import { default as Terminal } from './Terminal'

let component = undefined;
let selected_item = {model:{}};
let beforemoveloc = undefined;


const extension_whitelist = ["txt", "csv", "json", "py", "ini", "info", "md", "log", "conf", "cfg"];

function commandlog(str) {
  if(component && component.$refs && component.$refs.terminal) {
    component.$refs.terminal.handleLog(str);
  }
}

export default {
  name: 'Python',
  components: {
    mdbBtn,
    mdbRow,
    mdbCol,
    mdbCard,
    mdbCardBody,
    editor:ace_editor,
    Terminal,
  },
  beforeMount() {
    component = this;
    registerstdout(commandlog);
/*
    // Auto-fetch /flash
    on_connect().then(() => this.itemClick({model: this.files[0]}));
*/
  },
  methods: {
    save_ui: async () => {
      let parts = component.editorfilename.split(".");
      if((parts.length > 1 && extension_whitelist.indexOf(parts[parts.length-1].toLowerCase()) >= 0) || window.confirm("File: "+component.editorfilename+" has not a textfile extension")) {
        await savetextfile(component.editorfilename, component.content_editor);
        component.content_original = component.content_editor;
        component.updateNode(selected_item.$parent);
        component.$emit('genNotification','Save succes', 'Save succes', 'check', 'green', 30);
      }
    },
    runfile_ui: async () => {
      writetostdin("\x01" + component.content_editor + "\x04")
    },
    info() {

    },
    commandpython(e) {
      writetostdin(e);
    },
    connect:connect,
  },
  data () {
    return {
      content_editor:'',
      content_original:'',
      editorfilename:'/flash/cache/scratch.py',
      show: true,
    }
  }
}

</script>

<style scoped>
  .profile-card-footer {
    background-color: #F7F7F7 !important;
    padding: 1.25rem;
  }
  .card.card-cascade .view {
    box-shadow: 0 3px 10px 0 rgba(0, 0, 0, 0.15), 0 3px 12px 0 rgba(0, 0, 0, 0.15);
  }
  .btn.btn-lg {
    padding: .5rem .5rem !important;
  }
  .md-form {
   margin: 0 0 0 0;
  }
  input .input-lg {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }
  textarea {
    width:100%;
    height:400px;
  }
</style>

<style>
  .md-form .form-control {
    margin-bottom: 0;
  }
  .tree-selected {
    background: #eee !important;
  }
</style>
