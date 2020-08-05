$(function() {
  const mainTemplate = Handlebars.compile($('#main_template').html());

  $("script[type='text/x-handlebars']").each(function() {
    if ($(this).attr('data-type') === 'partial') {
      const name = $(this).attr('id');
      Handlebars.registerPartial(name, $(this).html());
    }
  });

  $('#main_template').remove();
  $("script[type='text/x-handlebars']").remove();

  const API = {
    getAllTodos: function() {
      return $.ajax({
        url: '/api/todos',
        method: 'GET'
      });
    },

    getTodo: function(id) {
      return $.ajax({
        url: `/api/todos/${id}`,
        method: 'GET'
      });
    },

    saveTodo: function(todo) {
      return $.ajax({
        url: '/api/todos',
        method: 'POST',
        data: todo
      });
    },

    updateTodo: function(id, todo) {
      return $.ajax({
        url: `/api/todos/${id}`,
        method: 'PUT',
        data: todo
      });
    },

    resetDatabase: function() {
      return $.ajax({
        url: '/api/reset',
        method: 'GET'
      });
    },

    deleteTodo: function(id) {
      return $.ajax({
        url: `/api/todos/${id}`,
        method: 'DELETE'
      });
    },
  };

  const TodoList = {
    filterCompleted: function(todos) {
      return todos.filter(todo => todo.completed);
    },

    sortedTodosByCompletion: function(todos) {
      return todos.sort((a, b) => {
        if (!a.completed && b.completed) {
          return -1;
        } else {
          return 1;
        }
      });
    },

    sortByDate: function(todos) {
      return todos.slice().sort((a, b) => {
        if (a.due_date === 'No Due Date') return -1;
        if (b.due_date === 'No Due Date') return 1;

        let dateA = this.getDate('20' + a.due_date.split('/')[1],
                                 a.due_date.split('/')[0]);
        let dateB = this.getDate('20' + b.due_date.split('/')[1],
                                 b.due_date.split('/')[0]);

        if (dateA > dateB) {
          return 1;
        } else if (dateA < dateB) {
          return -1;
        } else {
          return 0;
        }
      });
    },

    getDate(year, month) {
      return new Date(Number(year), (Number(month) - 1));
    },

    todosByDate: function(todos) {
      let result = {};

      this.sortByDate(todos).forEach(todo => {
        let date = todo.due_date;

        if (result[date]) {
          result[date].push(todo);
        } else {
          result[date] = [todo];
        }
      });

      return result;
    },

    doneTodosByDate: function(todos) {
      return this.todosByDate(this.filterCompleted(todos));
    },

    filterSelected: function(todos) {
      if (this.selected === 'All Todos') {
        return todos;
      } else if (this.selected === 'Completed') {
        return this.filterCompleted(todos);
      } else if (this.done) {
        const date = this.selected;

        return this.filterCompleted(todos).filter(todo => todo.due_date === date);
      } else  {
        const date = this.selected;

        return todos.filter(todo => todo.due_date === date);
      }
    },
  };

  const App = {
    refreshDOM: function() {
      API.getAllTodos().done(todos => {
        todos = todos.map(todo => {
          const hasDate = todo.month.length > 0 && todo.year.length > 0;
          const year = todo.year.slice(2);

          return {
            id: todo.id,
            completed: todo.completed,
            title: todo.title,
            due_date: (hasDate) ? `${todo.month}/${year}` : 'No Due Date'
          };
        });

        App.renderTodos(todos, TodoList.done);

        this.highlightGroup(TodoList.done);
      });
    },

    highlightGroup: function() {
      if (TodoList.selected === 'Completed') {
        $('#all_done_header').addClass('active');
      } else if (TodoList.selected === 'All Todos') {
        $('#all_header').addClass('active');
      } else if (TodoList.done) {
        $('#completed_lists').find(`dl[data-title='${TodoList.selected}']`).addClass('active');
      } else {
        $('#all_lists').find(`dl[data-title='${TodoList.selected}']`).addClass('active');
      }
    },

    renderTodos: function(todos) {
      $('body').html(mainTemplate({
        todos: TodoList.sortedTodosByCompletion(todos),
        todos_by_date: TodoList.todosByDate(todos),
        done: TodoList.filterCompleted(todos),
        done_todos_by_date: TodoList.doneTodosByDate(todos),
        selected: TodoList.filterSelected(todos),
        current_section: {
          title: TodoList.selected,
          data: TodoList.filterSelected(todos).length
        }
      }));
    },

    showModal: function(data) {
      if (data) {
        $('#title').val(data.title);
        if (data.day) $('#due_day').val(data.day);
        if (data.month) $('#due_month').val(data.month);
        if (data.year) $('#due_year').val(data.year);
        if (data.description) $("textarea[name='description']").val(data.description);
      }

      $('#modal_layer').fadeIn();
      $('#form_modal').css('top', '200px').fadeIn();
    },

    hideModal: function(done) {
      $('form').trigger('reset');
      $('#modal_layer').fadeOut();
      $('#form_modal').fadeOut();
      this.id = -1;
      this.refreshDOM();
    },

    createValidTodo: function() {
      let todo = {};

      todo.title = $('#title').val();
      if ($('#due_day').val() !== 'Day') todo.day = $('#due_day').val();
      if ($('#due_month').val() !== 'Month') todo.month = $('#due_month').val();
      if ($('#due_year').val() !== 'Year') todo.year = $('#due_year').val();
      if ($("textarea[name='description']").val().length > 0) {
        todo.description = $("textarea[name='description']").val();
      }

      return todo;
    },

    markComplete(id) {
      API.updateTodo(id, { completed: true }).done((todo) => {
        $(`input[id='item_${this.id}']`).attr('checked', true);
        const done = (todo.completed) ? true : false;
        this.hideModal();
      });
    },

    toggleCompleted(event) {
      if (event.target.tagName === 'LABEL') return;

      const id = $(event.target).parent().attr('data-id');
      const isCompleted = !$(`input[id='item_${id}']`).attr('checked');

      API.updateTodo(id, { completed: isCompleted }).done((todo) => {
        $(`input[id='item_${id}']`).attr('checked', isCompleted);
        this.refreshDOM();
      });
    },

    handleModalSubmit: function(event) {
      event.preventDefault();

      const todo = this.createValidTodo();
      const editMode = this.id > 0;
      const invalidTitle = todo.title.length < 3;

      if (invalidTitle) {
        alert('You must enter a title at least 3 characters long.');
        return;
      }

      if (editMode) {
        API.updateTodo(this.id, todo);
        this.hideModal();
      } else {
        API.saveTodo(todo);
        TodoList.selected = "All Todos";
        this.hideModal();
      }
    },

    handleDeleteButton: function(event) {
      const id = $(event.target).closest('tr').attr('data-id');

      API.deleteTodo(id).done(() => this.refreshDOM());
    },

    handleCompleteButton: function(event) {
      if (this.id < 0) {
        alert('Cannot mark as complete as item has not been created yet!');
      } else {
        this.markComplete(this.id);
      }
    },

    handleNewTodoClick: function() {
      this.showModal();
    },

    handleTodoClick: function(event) {
      event.preventDefault();
      this.id = $(event.target).parent().parent().attr('data-id');

      API.getTodo(this.id).done(todo => {
        this.showModal(todo);
      });
    },

    handleSidebarClick: function(event) {
      if ($(event.target).closest('article').length === 0 &&
          $(event.target).closest('header').length > 0) {
        TodoList.selected = $(event.target).closest('header').attr('data-title');
        TodoList.done = (TodoList.selected === 'All Todos') ? false : true;
        this.refreshDOM();
      }

      if ($(event.target).closest('article').length > 0 &&
          $(event.target).closest('article').attr('id') === 'all_lists') {
        TodoList.selected = $(event.target).closest('dl').attr('data-title');
        TodoList.done = false;
        this.refreshDOM();
      }

      if ($(event.target).closest('article').length > 0 &&
          $(event.target).closest('article').attr('id') === 'completed_lists') {
        TodoList.selected = $(event.target).closest('dl').attr('data-title');
        TodoList.done = true;
        this.refreshDOM();
      }
    },

    bindEventHandlers: function() {
      $('body').on('click', "label[for='new_item']", this.handleNewTodoClick.bind(this));
      $('body').on('click', '#modal_layer', this.hideModal.bind(this));
      $('body').on('click', "button[name='complete']", this.handleCompleteButton.bind(this));
      $('body').on('submit', '#form_modal', this.handleModalSubmit.bind(this));
      $('body').on('click', '.delete', this.handleDeleteButton.bind(this));
      $('body').on('click', '.list_item label', this.handleTodoClick.bind(this));
      $('body').on('click', 'td.list_item', this.toggleCompleted.bind(this));
      $('body').on('click', '#sidebar', this.handleSidebarClick.bind(this));
    },

    init: function() {
      this.id = -1;
      TodoList.selected = 'All Todos';
      TodoList.done = false;
      this.refreshDOM();
      this.bindEventHandlers();
    }
  };

  App.init();
});
