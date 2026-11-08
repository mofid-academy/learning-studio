/* Route selection changes presentation only; the portal API still enforces roles. */
(function () {
  'use strict';
  function route(value) {
    const url = new URL(value);
    const admin = /\/admin\.html$/.test(url.pathname);
    return {
      participant: !admin,
      redirect: !admin && url.searchParams.get('portal') === 'admin'
        ? new URL('./admin.html', url).href : null
    };
  }
  function replaceOnce(source, before, after, name) {
    if (source.split(before).length !== 2) throw new Error('Studio source mismatch: ' + name);
    return source.replace(before, after);
  }
  function prepare(source, participant) {
    let html = replaceOnce(source,
      "const participant=new URLSearchParams(location.search).get('portal')==='participant';",
      'const participant=' + Boolean(participant) + ';', 'portal route');
    const oldKey = "'mofid-portal-session'";
    if (html.split(oldKey).length !== 4) throw new Error('Studio source mismatch: session scope');
    html = html.replaceAll(oldKey, participant
      ? "'mofid-studio-participant-session'" : "'mofid-studio-admin-session'");
    html = replaceOnce(html,
      "const me=await mfApi('me');mofidPortalUser=me.user;",
      "const me=await mfApi('me');if(!participant&&me.user.role!=='admin')throw Error('این حساب دسترسی مدیریت استودیو ندارد.');mofidPortalUser=me.user;",
      'restored administrator role');
    html = replaceOnce(html,
      "href:link,target:'_blank',rel:'noopener noreferrer',",
      'href:link,', 'participant link');
    return html;
  }
  window.MofidStudioRouting = Object.freeze({route, prepare});
})();
