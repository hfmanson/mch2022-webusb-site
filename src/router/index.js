import Vue from 'vue';
import Router from 'vue-router';
import Apps from '@/components/Apps';
import Programming from '@/components/Programming';
import Update from '@/components/Update';
import Settings from '@/components/Settings';
import Python from '@/components/Python';
import BadGateway from '@/components/BadGateway';


Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/apps',
      name: 'Apps',
      component: Apps,
      props: { page: 1 },
      alias: '/'
    },
    {
      path: '/programming',
      name: 'Programming & Files',
      props: { page: 2 },
      component: Programming
    },
    {
      path: '/update',
      name: 'Update',
      props: { page: 3 },
      component: Update
    },
    {
      path: '/settings',
      name: 'Settings',
      props: { page: 4 },
      component: Settings
    },
    {
      path: '/python',
      name: 'Python',
      props: { page: 5 },
      component: Python
    },
    {
      path: '/404',
      name: 'BadGateway',
      props: { page: 6 },
      component: BadGateway
    },
    {
      path: '*',
      props: { page: 6 },
      redirect: '/404'
    }
  ]
})