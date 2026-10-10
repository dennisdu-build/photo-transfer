import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import App from './App.vue';
import HomePage from './pages/HomePage.vue';
import MobilePage from './pages/MobilePage.vue';
import './index.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/m/:code', name: 'mobile', component: MobilePage },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
