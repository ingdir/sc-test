$(function() {
    
    $('.timecodes').each(function(i, el) {
        var id = $(el)
            .closest('[data-sc-track]')
            .attr('data-sc-track');
        
        if (id) {
            $(el).empty();
            
            $('<a/>')
                .attr('href', 'http://shirshin.com/sc#' + id)
                .attr('target', 'sc_test')
                .text('Add to player')
                .appendTo(el);
        }
    });
});