const express = require('express');
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const moment = require('moment');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
mongoose.connect('mongodb://localhost:27017/hunsu');
const db = mongoose.connection;
const autoIncrement = require('mongoose-auto-increment');



// DB 커넥트 성공 여부
db.once('err', () => {
    console.log(err);
});

db.once('open', () => {
    console.log('DB connected');
});

// User 스키마
// id, 비밀번호, 이름, 이메일, 주소를 저장한다.
const UserSchema = mongoose.Schema({
    user_id: String,
    password: String,
    name: String,
    email: String,
    address: String,
});
const User = mongoose.model('users', UserSchema);

// Advice 스키마
// Post 스키마의 code_advice에 저장될 정보들의 형식이다.
// Advice가 저장될 Line, Advice를 작성하는 유저의 id, Advice 본문으로 구성된다.
const AdviceSchema = mongoose.Schema({
    content_line    : { type : Number },
    user_id         : { type : String },
    advice          : { type : String } 
});
const Advice = mongoose.model('advice', AdviceSchema);

// Post 스키마
// 각 Post의 번호, 작성자, 제목, 카테고리, 내용, 게시일, Advice들, 조회수로 구성된다.
// 게시글을 보여줄 때 한줄씩 끊어서 보여주기 위해서 content는 배열로 지정한다.
const PostSchema = mongoose.Schema({
    post_no             : { type: Number },
    user_id             : { type: String },
    post_title          : { type: String },
    post_kategorie      : { type: String },
    post_content        : { type: Array },
    date                : { type: String },
    code_advice         : { type: [AdviceSchema] },
    viewcnt             : { type: Number }
});
// 아래는 post_no가 자동으로 1씩 증가하면서 저장하도록 하기 위한 과정이다.
autoIncrement.initialize(db);
PostSchema.plugin(autoIncrement.plugin,{
    model : 'posts', 
    field : 'post_no',
    startAt : 1, //시작
    increment : 1 // 증가 
});
const Post = mongoose.model('posts', PostSchema);



//이것저것 설정
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname + '/css'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017"
})}));

let page_state = 0;         // 페이지 중앙에 어떤 콘텐츠를 보여줄지 결정하기 위한 변수이며 이 변수를 이용하여 중앙의 컨텐츠를 바꾼다.
var idx = 0;                // 게시판에서 게시물 제목을 클릭했을 때 게시물의 post_no를 저장하는 변수
var limit_page = 0;         // 게시판에서 보여줄 수 있는 최대 page 수. 최대 10
var max_page = 0;           // 현재 DB에 저장된 게시물을 계산하여 마지막 페이지의 값이 저장될 변수
var page_kategorie = "";    // 현재 페이지의 카테고리가 무엇인지 구분해주는 변수
var posts;                  // 각 이벤트마다 DB에서 posts의 요소를 불러와서 변수로 사용할 때 이용하는 변수
var password_update = 0     // 비밀번호 변경 시 사용할 변수
var userinfo_update = 0     // 회원정보 수정 시 사용할 변수
var before_page_state       // 게시글 작성 이전의 페이지 상태를 저장하기 위한 변수


// 메인 페이지
app.get('/', async (req, res) => {
    // 로그인을 한 상태라면 실행
    if (req.session.logined) {
        // Post 보기
        if (page_state == 2) {
            var post = await Post.find({}).exec();
            var selected_post

            // 클릭한 게시글의 번호와 일치하는 게시글 정보 검색
            for(let j = 0; j < post.length; j++){
                if(post[j].post_no == idx){
                    selected_post = post[j];
                }
            }

            ///게시글 클릭 시 조회수 증가
            ///게시글을 클릭하여 페이지상태값이 2가 될 경우
            ///updateOne문, post_no를 통해 조회수값 viewcnt를 찾아서 +1
            Post.updateOne({ "post_no" : selected_post.post_no }, 
                {$set: { "viewcnt" : selected_post.viewcnt + 1 }},
                (err, post) => {
                if (err) return res.json(err);
                console.log('viewcnt + 1');
            })

            // 페이지를 띄우기 위해 데이터를 입력하고 main.ejs를 불러온다.
            res.render('main', {
                id : req.session.user_id,   // navbar에 표시될 id이며 main을 불러올때 꼭 같이 보내주어야 한다.
                post : selected_post,       // 사용자가 클릭한 post의 내용
                page_state : page_state,    // 페이지의 상태
            })
        } 
        // MyPage
        else if (page_state == 6){
            // session에 저장된 사용자의 id로 사용자의 정보 수집
            var user = await User.findOne({ "user_id" : req.session.user_id })
            // 사용자가 작성한 게시글 검색
            posts = await Post.find({"user_id" : user.user_id}).sort({post_no: -1})

            // 한 페이지에 5개씩 보여주기 위한 설정
            if ((posts.length % 5) == 0) {
                limit_page = parseInt(posts.length / 5);
                max_page = parseInt(posts.length / 5);
            } else {
                limit_page = parseInt((posts.length / 5) + 1);
                max_page = parseInt((posts.length / 5) + 1);
            }

            // 페이지를 띄우기 위해 데이터를 입력하고 main.ejs를 불러온다.
            res.render('main', {
                id                  : req.session.user_id,  // navbar에 표시될 id이며 main을 불러올때 꼭 같이 보내주어야 한다.
                user                : user,                 // DB에서 추출한 사용자의 정보
                posts               : posts,                // DB에서 추출한 사용자가 작성한 게시글
                page_state          : page_state,           // 페이지의 상태
                limit_page          : limit_page,           // 한번에 보여주는 최대 페이지 갯수
                password_update     : password_update,      // 비밀번호 변경 여부 확인
                userinfo_update     : userinfo_update       // 회원정보 수정 여부 확인
            })
            // update 변수들 초기화
            userinfo_update = 0
            password_update = 0
        } 
        // 그 외 (ALL, C, Java, Python List)
        else{
            // 페이지 리스트
            // 0은 ALL이므로 전부 검색
            if(page_state == 0){
                posts = await Post.find({})
                                      .sort({post_no: -1})
            } 
            // 나머지는 각 항목마다 카테고리가 존재하므로 카테고리 별로 검색
            else{
                posts = await Post.find({"post_kategorie" : page_kategorie})
                                      .sort({post_no: -1})
            }

            // 한 페이지에 10개씩 보여주기 위한 설정
            if ((posts.length % 10) == 0) {
                limit_page = parseInt(posts.length / 10);
                max_page = parseInt(posts.length / 10);
            } else {
                limit_page = parseInt((posts.length / 10) + 1);
                max_page = parseInt((posts.length / 10) + 1);
            }

            // 페이지를 띄우기 위해 데이터를 입력하고 main.ejs를 불러온다.
            res.render('main', {
                id          : req.session.user_id,      // navbar에 표시될 id이며 main을 불러올때 꼭 같이 보내주어야 한다.
                posts       : posts,                    // DB에서 검색한 게시물의 정보
                page_state  : page_state,               // 페이지 상태
                limit_page    : limit_page,             // 한번에 보여주는 최대 페이지 갯수
            });
        };
    } else {
        // 로그인을 하지 않았다면 로그인을 하기 위해 login 페이지를 불러온다.
        res.render('login');
    }
});

// 페이징
app.get('/page/:page', async (req,res,next) => {
    var page = req.params.page;     // 사용자가 클릭한 페이지 넘버
    var sub_posts                   // 다시 추출한 게시글을 저장하기 위한 변수

    // page 변수가 999일 때 바로 마지막 페이지까지 이동하기 위한 설정
    if(page == 999)
        page = max_page

    // All 리스트
    if(page_state == 0){
        sub_posts = await Post.find({})
                              .sort({post_no: -1})
                              .skip((page - 1) * 10)
    }
    // MyPage
    else if(page_state == 6){
        sub_posts = await Post.find({"user_id" : req.session.user_id})
                              .sort({post_no: -1})
                              .skip((page - 1) * 5)
    }
    // C, Java, Python
    else{
        sub_posts = await Post.find({"post_kategorie" : page_kategorie})
                              .sort({post_no: -1})
                              .skip((page - 1) * 10)
    }

    // 보내는 정보는 위와 동일하다.
    // MyPage
    if (page_state == 6){
        var user = await User.findOne({ "user_id" : req.session.user_id })
        res.render('main', {
            id                  : req.session.user_id,
            user                : user,
            posts               : sub_posts,
            page_state          : page_state,
            limit_page          : limit_page,
            password_update     : password_update,
            userinfo_update     : userinfo_update
        });
    }
    // ALL, C, Java, Python
    else{
        res.render('main', {
            id          : req.session.user_id,
            posts       : sub_posts,
            page_state  : page_state,
            limit_page    : limit_page,
        });
    }

});

// 회원가입
app.post('/register', (req, res) => {
    var uid = req.body.user_id;         // ID
    var upwd = req.body.password;       // 비밀번호
    var uname = req.body.name;          // 이름
    var uemail = req.body.email;        // E-Mail
    var uaddress = req.body.address;    // 주소

    User.findOne({ "user_id": uid }, (err, user) => {
        if (err) return res.json(err);
        if (!user) {
            User.create({ "user_id": uid, "password": upwd, "name": uname, "email": uemail, "address": uaddress }, (err) => {
                if (err) return res.json(err);
                // 회원가입 성공 시 result는 true
                res.render('registerResult', {
                    result: true
                });
            })
        } else {
            // 회원가입 실패 시 result는 false
            res.render('registerResult', {
                result: false
            });
        }
    })
});

//아이디 찾기
app.post('/findIDRst', (req, res) => {
    var uname = req.body.name;          // 이름
    var uemail = req.body.email;        // E-Mail
    var uaddress = req.body.address;    // 주소
    User.findOne({ "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        if (user) {
            // 아이디 찾기 성공 시 Findid에 찾은 아이디 저장
            res.render('findIDResult', {
                Findid: user.user_id
            });
        } else {
            // 아이디 찾기 실패 시 Findid에 null 저장
            res.render('findIDResult', {
                Findid: null
            });
        }
    })
})

// 비밀번호 찾기
app.post('/findPasswordRst', (req, res) => {
    var uid = req.body.user_id;         // ID
    var uname = req.body.name;          // 이름
    var uemail = req.body.email;        // E-Mail
    var uaddress = req.body.address;    // 주소

    User.findOne({ "user_id": uid, "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        // 회원가입한 유저가 맞을 경우
        if (user) {
            res.render('findPasswordResult', {
                result: uid
            });
        // 회원가입한 유저가 아닐 경우
        } else {
            res.render('findPasswordResult', {
                result: null
            });
        }
    })
})

// 비밀번호 찾기 후 새로운 비밀번호 만들기
app.post("/newPassword", (req, res) => {
    var uid = id;
    var pass1 = req.body.password1;
    var pass2 = req.body.password2;

    // 새로운 비밀번호 2칸 다 같을 경우
    if(pass1 == pass2) {
        // updateOne으로 id를 찾아서 password 업데이트
        // result값에 true를 주고 newPasswordResult 페이지 불러오기
        User.updateOne({ "user_id":uid }, 
                {$set: { password:pass1 }},
                (err, user) => {
                if (err) return res.json(err);
                console.log('Success');
                res.render('newPasswordResult', {
                    result: true
                });
        })
    }
    // 새로운 비밀번호 2칸이 서로 다를 경우
    else {
        // result값에 false를 주고 newPasswordResult 페이지 불러오기
        res.render('newPasswordResult', {
            result: false
        });
    }
});

//게시글 작성
app.post('/uploadPost', (req, res) => {
    var user_id = req.session.user_id;                  // 작성자
    var post_title = req.body.post_title;               // 제목
    var post_kategorie = req.body.post_kategorie;       // 카테고리
    var post_content = req.body.post_content;           // 내용
    var content = post_content.split(/\r\n|\r\n/);      // 내용의 들여쓰기 및 엔터 인식
    var date = moment().format("YYYY-MM-DD HH:mm:ss");  // 게시일

    Post.findOne({})
        .exec( (err, post) =>{
            if (err) return res.json(err);
            // 게시글 등록
            Post.create({ "user_id": user_id, "post_title": post_title, "post_kategorie": post_kategorie,
                        "post_content": content, "date": date, "viewcnt": 0 }, (err) => {
                if (err) return res.json(err);
                console.log('Success');
                page_state = before_page_state; // 게시글 작성 버튼 클릭 전의 페이지로 돌아가기 위한 과정
                res.redirect('/');
            });
        });
});

// 게시글 삭제
app.get('/deletePost/:delete_post_no', (req, res) => {
    // 삭제할 게시물의 post_no를 가져와서 검색 후 해당 도큐먼트 삭제
    Post.deleteOne({ "post_no" : req.params.delete_post_no }, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            page_state = 0;     // ALL 페이지로 돌아감
            res.redirect('/');
        }
    });
});

//로고 및 목록 클릭시 홈 화면으로 가기
app.get('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})

//로그아웃 버튼 클릭
app.post('/logout', (req, res) => {
    // 세션 삭제
    req.session.destroy();
    res.redirect('/');
});

//회원가입 버튼 클릭
app.post('/regist', (req, res) => {
    res.render('register');
})

//아이디 찾기 버튼 클릭
app.post('/findID', (req, res) => {
    res.render('findID');
})

//비밀번호 찾기 버튼 클릭
app.post('/findpwd', (req, res) => {
    res.render('findPassword');
})

//뒤로가기 버튼 클릭
app.post('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})



//로그인 버튼 클릭
app.post('/', (req, res) => {
    let uid = req.body.user_id;     // ID
    let upwd = req.body.password;   // 비밀번호
    User.findOne({ "user_id" : uid }, (err, user) => {
        if (err) return res.json(err);

        // 해당하는 ID가 없을 때
        if (!user) {
            console.log('Cannot find user');
            res.send(`
                    <a href="/">Back</a>
                    <h1>rechecking your ID -Can't find user</h1>
                `);
        } 
        // ID가 존재함
        else {
            // ID로 검색한 user의 비밀번호와 로그인 화면에 입력한 비밀번호가 같은지 비교
            if (user.password == upwd){
                console.log('welcome');
                req.session.user_id = uid;
                req.session.logined = true;
                res.redirect('/');
            }
            // 같지 않음
            else {
                console.log('login failed');
                res.send('<a href="/">Back</a><h1>Login failed - different password</h1>');
            }
        }
    });
});

// 게시글 작성 버튼 클릭
// 페이지 상태값 1
app.post('/writePost_btn', (req, res) => {
    before_page_state = page_state;
    page_state = 1;
    res.redirect('/');
})

// 게시글을 보기위해 제목을 클릭했을 때
// 페이지 상태값 2
app.get('/read/:post_no',(req,res,next) => {
    page_state = 2;
    idx = req.params.post_no;       // 게시물의 post_no 저장
    res.redirect('/');
});

// C 메뉴 클릭 시
// 페이지 상태값 3
app.get('/board_c', (req, res) => {
    page_state = 3;
    page_kategorie = "C";
    res.redirect('/');
});

// Java 메뉴 클릭 시
// 페이지 상태값 4
app.get('/board_java', (req, res) => {
    page_state = 4;
    page_kategorie = "Java"
    res.redirect('/');
});

// Python 메뉴 클릭 시
// 페이지 상태값 5
app.get('/board_python', (req, res) => {
    page_state = 5;
    page_kategorie = "Python"
    res.redirect('/');
});

// MyPage 메뉴 클릭 시
// 페이지 상태값 6
app.get('/board_userinfo', (req, res) => {
    page_state = 6;
    res.redirect('/');
});

// 비밀번호 변경
app.post('/edit_password', async (req, res) => {
    var first = req.body.editPW_first;      // 비밀번호 입력값
    var second = req.body.editPW_second;    // 비밀번호 확인값

    // 두 항목이 같다면 비밀번호 변경
    if (first == second) {
        User.updateOne({"user_id" : req.session.user_id}, {"password" : first}, (err, user) =>{
            if (err) return res.json(err);

            console.log('password update success');
            password_update = 1     // 비밀번호 변경 성공
            res.redirect('/');
        })
    }
    // 실패 시
    else{
        console.log('password update fail');
        password_update = 2         // 비밀번호 변경 실패
        res.redirect('/');
    }
})

// MyPage에서 회원정보 수정 버튼 클릭 시
// 유저의 이름, 이메일, 주소 정보 업데이트
app.post('/user_update', (req, res) => {
    var id = req.session.user_id;   // 현재 접속중인 유저 아이디
    var name = req.body.name;       // 유저의 이름
    var email = req.body.email;     // 유저의 이메일
    var address = req.body.address; // 유저의 주소

    // update문, 유저 아이디로 이름, 이메일, 주소를 찾아서 업데이트
    User.update({ "user_id" : id }, {$set : { "name" : name, "email" : email, "address" : address}}, {multi : true}, (err, user) => {
        if (err) return res.json(err);

        console.log('userinfo update Success');
        userinfo_update = 1     // 유저정보 수정 확인
        res.redirect('/');
    })
});

// 훈수 추가
app.post('/write_advice', async (req, res) => {
    var input_user_id = req.session.user_id;        // 훈수 작성자
    var input_advice = req.body.advice;             // 훈수 내용
    var input_line = req.body.line * 1;             // 훈수 둘 Line
    var search_number = req.body.post_no;           // 현재 post_no

    // 현재 보여지는 게시글의 post_no로 현재 위치 검색
    Post.findOne({ "post_no" : search_number })
        .exec( (err, post) =>{
            if (err) return res.json(err);

            // 해당 post에 Advice 추가
            post.code_advice.push(new Advice({
                content_line : input_line,
                user_id : input_user_id,
                advice : input_advice
            }))
            // 저장
            post.save(function(err){
                if(!err)
                    console.log('advice saved!')
            })
            res.redirect('/');
    });
});

// 훈수 보기
app.post('/read_advice', (req, res) => {
    var search_number = req.body.post_no;   // 현재 post_no
    var line = req.body.line;               // 클릭한 Line
    var make_table_string = "";             // 보여줄 내용
    var isEmpty_Advice = 0                  // Advice의 존재 여부 확인 변수

    Post.findOne({ "post_no" : search_number })
        .exec( (err, post) =>{
            if (err) return res.json(err);

            // 클릭한 Line에 Advice가 존재하는지 검색
            for ( let j = 0; j < post.code_advice.length; j++){
                if(post.code_advice[j].content_line == line){
                    // 있다면 변수 설정
                    isEmpty_Advice = 1;
                }
            }

            // 해당 Line에 Advice가 없을 때
            if ( isEmpty_Advice == 0 ) {
                make_table_string = "해당 Line에는 Advice가 없습니다!"
            }
            // 해당 Line에 Advice가 있을 때
            else {
                // 테이블 태그를 여기서 설정함
                make_table_string = "<table class='table'><thead>" +
                                        "<tr>" +
                                            "<th scope='col' col width='20%'>ID</th>" +
                                            "<th scope='col' col width='80%'>Advice</th>" +
                                        "</tr>" +
                                    "</thead>" +
                                    "<tbody>";
                // Advice 내용 추출 및 설정
                for (var i = 0 ; i < post.code_advice.length ; i++) {
                    if (post.code_advice[i].content_line == line){
                        make_table_string = make_table_string + "<tr>" +
                                                                    "<td>" + 
                                                                        post.code_advice[i].user_id +
                                                                    "</td>"+
                                                                    "<td>" + 
                                                                        post.code_advice[i].advice +
                                                                    "</td>"+
                                                                "</tr>"
                    }
                }
                make_table_string = make_table_string + "</tbody></table>"
            }
            // 만들어진 table태그를 본문에 전달
            res.send(make_table_string)
        });
});

// 서버 실행
// 3000번 포트
app.listen(3000, () => {
    console.log('listening 3000port');
});