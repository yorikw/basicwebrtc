$.fn.extend({
    qrcode: function (data) {
        data = $.extend({}, {
            api: 'https://chart.googleapis.com/chart?cht=qr&chs={0}&chl={1}',
            height: 200,
            width: 200,
            value: data
        }, data);
        return this.each(function () {
            var size = `${data.height}x${data.width}`;
            var uri = data.api.format(size, data.value);
            $(this).append(`<img src="${uri}" alt="QR Code" />`);
        });
    }
});

String.prototype.format = function () {
    var s = this,
        a = arguments;
    $(a).each(function (i) {
        var reg = new RegExp("\\{" + i + "\\}", "gm");
        s = s.replace(reg, a[i]);
    });
    return s;
};